const functions = require('firebase-functions');
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { parse } = require("csv-parse");
const path = require("path");
const axios = require('axios');
const sanitizeHtml = require('sanitize-html');
const cors = require('cors');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const OpenAI = require('openai');

// Initialize admin SDK ONCE at the top level
initializeApp();

const db = getFirestore();
const storage = getStorage();

// Initialize CORS handler
const corsHandler = cors({
  origin: true, // Allows all origins - CHANGE FOR PRODUCTION: origin: ['https://my-legal-app.com']
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// --- Helper Functions ---

function getCongressApiKey() {
    const key = '';
    if (!key) {
        logger.error('Missing CONGRESS_API_KEY environment variable.');
        // Throw a standard Error for onRequest functions
        throw new Error('Server configuration error: Missing API key.');
  }
  return key;
}

function getOpenaiApiKey(){
    const key = '';
    if (!key) {
        logger.error('Missing OPENAI_API_KEY environment variable.');
        throw new Error('Server configuration error: Missing API key.');
    }
    return key;
}

async function verifyFirebaseToken(req) {
    const authorizationHeader = req.headers.authorization || '';
    if (!authorizationHeader.startsWith('Bearer ')) {
        logger.warn('verifyFirebaseToken: No Bearer token found.');
        // Throwing an error that the main handler can catch and convert to 401
        const error = new Error('Unauthorized: No token provided.');
        error.code = 'unauthenticated'; // Add code for specific handling
        throw error;
    }
    
    const idToken = authorizationHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        logger.info('verifyFirebaseToken: Token verified for UID:', decodedToken.uid);
        return decodedToken; // Contains uid, email, etc.
    } catch (error) {
        logger.error('verifyFirebaseToken: Error verifying token:', error);
        const err = new Error('Unauthorized: Invalid or expired token.');
        err.code = 'unauthenticated'; // Add code for specific handling
        throw err;
    }
}

// --- Cloud Functions ---

/**
 * Get detailed data for a specific bill (Authenticated)
*/
exports.getBillDetail = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        try {
      // Authenticate request FIRST
      await verifyFirebaseToken(req);

      const { congress, type, number } = req.query;
      if (!congress || !type || !number) {
        return res.status(400).json({ error: 'Missing required parameters.' });
      }

      const cacheKey = `${congress}-${type}-${number}`;
      const cacheRef = db.collection('billCache').doc(cacheKey);
      const cacheDoc = await cacheRef.get();
      const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
      if (cacheDoc.exists) {
        const cached = cacheDoc.data();
        if (cached.timestamp && (Date.now() - cached.timestamp < CACHE_TTL_MS) && cached.billDetail) {
          logger.info(`Serving bill detail for ${cacheKey} from cache.`);
          return res.status(200).json(cached.billDetail);
        }
      }

      const key = getCongressApiKey();
      // Normalize and encode parameters to match API requirements
      const congressParam = encodeURIComponent(congress);
      const typeParam = encodeURIComponent(type.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
      const numberParam = encodeURIComponent(number.toString().trim());
      const detailUrl = `https://api.congress.gov/v3/bill/${congressParam}/${typeParam}/${numberParam}?api_key=${key}`;
      logger.info(`getBillDetail URL: ${detailUrl.replace(key, '***')}`);
      const billResp = await axios.get(detailUrl);
      const bill = billResp.data.bill;

      if (!bill) {
        logger.warn(`getBillDetail: Bill not found in API for ${congress}-${type}-${number}`);
        return res.status(404).json({ error: 'Bill not found' });
      }

      // --- VVV --- START: Fetch Text & Amendments Logic (Ported) --- VVV ---
      let textHtml = '';
      let textPlain = '';
      let amendmentList = [];

      // Fetch Bill Text
      if (bill.textVersions?.url) {
        try {
          const textVersionsListUrl = `${bill.textVersions.url}${bill.textVersions.url.includes('?') ? '&' : '?'}api_key=${key}`;
          const textListResp = await axios.get(textVersionsListUrl);
          let formats = textListResp.data.textVersions?.[0]?.formats || [];

          // Define preference order (can be adjusted)
          const formatOrder = [
            { type: 'Plain Text', prop: 'textPlain' },
            { type: 'Formatted Text', prop: 'textHtml' }
            // Add XML or PDF handling here if needed later
          ];

          for (const pref of formatOrder) {
            const foundFormat = formats.find(f => f.type === pref.type && f.url);
            if (foundFormat) {
              try {
                // Ensure API key is appended to the specific format URL too
                const formatUrl = `${foundFormat.url}${foundFormat.url.includes('?') ? '&' : '?'}api_key=${key}`;
                logger.info(`Fetching text format ${pref.type} from ${formatUrl.replace(key, '***')}`);
                const textContentResp = await axios.get(formatUrl);
                let rawText = textContentResp.data;

                if (pref.type === 'Formatted Text') {
                  // Try PRE tag extraction first
                  const match = String(rawText).match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
                  if (match && match[1]) {
                    logger.info(`Extracted text from <pre> tag for ${congress}-${type}-${number}`);
                    textPlain = match[1].trim(); // Prioritize plain text if PRE found
                    textHtml = ''; // Clear HTML
                    break; // Found usable text, stop searching formats
                  } else {
                    // Sanitize if no PRE found
                    logger.info(`Sanitizing Formatted Text for ${congress}-${type}-${number}`);
                    textHtml = sanitizeHtml(rawText, {
                      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'ul', 'ol', 'li', 'pre', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td']),
                      allowedAttributes: { 'a': ['href'], 'img': ['src', 'alt'] }, // Allow links and basic images
                    });
                    textPlain = ''; // Clear plain if sanitized HTML used
                  }
                } else if (pref.type === 'Plain Text') {
                  textPlain = rawText;
                  textHtml = ''; // Clear HTML
                }
                // Stop searching if we got content
                if (textHtml || textPlain) {
                  logger.info(`Successfully fetched bill text as ${pref.type} for ${congress}-${type}-${number}`);
                  break;
                }
              } catch (fetchErr) {
                logger.warn(`Failed to fetch/process bill text as ${pref.type} for ${congress}-${type}-${number}:`, fetchErr.message);
                // Continue to the next format
              }
            }
          }
          if (!textHtml && !textPlain) {
            logger.warn(`No usable bill text format found or fetched for ${congress}-${type}-${number}.`);
          }
        } catch (textListErr) {
          logger.error(`Error fetching text versions list for ${congress}-${type}-${number}:`, textListErr.message);
        }
      } else {
        logger.info(`No textVersions URL found for ${congress}-${type}-${number}.`);
      }

      // Fetch Amendments
      if (bill.amendments?.url) {
        try {
          const amendUrl = `${bill.amendments.url}${bill.amendments.url.includes('?') ? '&' : '?'}api_key=${key}`;
          logger.info(`Fetching amendments from ${amendUrl.replace(key, '***')}`);
          const amendResp = await axios.get(amendUrl);
          // Map to a simpler structure if desired
          amendmentList = (amendResp.data.amendments || []).map(a => ({
            number: a.number,
            type: a.type,
            purpose: a.purpose,
            description: a.description, // Add description if available
            latestActionDate: a.latestAction?.actionDate || '',
            latestActionText: a.latestAction?.text || '',
            url: a.url // Link to the amendment details page on congress.gov
          }));
          logger.info(`Found ${amendmentList.length} amendments for ${congress}-${type}-${number}`);
        } catch (err) {
          logger.error(`Error fetching amendments for ${congress}-${type}-${number}:`, err.message);
        }
      }
      // --- ^^^ --- END: Fetch Text & Amendments Logic --- ^^^ ---

      // Construct meta object using data from the fetched 'bill' object
      const meta = {
        identifier: `${bill.type || 'N/A'} ${bill.number || 'N/A'}`,
        congress: bill.congress ? `${bill.congress}th Congress` : 'N/A',
        title: bill.title || 'No Title Available',
        status: bill.latestAction?.text || 'Status not available',
        sponsor: bill.sponsors?.[0]?.name || 'N/A',
        sponsorParty: bill.sponsors?.[0]?.party || 'N/A',
        sponsorState: bill.sponsors?.[0]?.state || 'N/A',
        sponsorDistrict: bill.sponsors?.[0]?.district || 'N/A',
        introducedDate: bill.introducedDate || 'N/A',
        lastAction: {
          date: bill.latestAction?.actionDate || 'N/A',
          description: bill.latestAction?.text || 'No recent action',
        },
        keyText: textPlain ? (textPlain.length > 300 ? textPlain.slice(0, 300) + '...' : textPlain) : 'Key text not available',
      };

      const responseToCache = { textHtml, textPlain, meta, amendmentList };
      await cacheRef.set({
        billDetail: responseToCache,
        timestamp: Date.now(),
      });
      logger.info(`Cached bill detail for ${cacheKey}.`);
      res.status(200).json(responseToCache);

    } catch (err) {
      logger.error(`getBillDetail error for ${req.query.congress}-${req.query.type}-${req.query.number}:`, err.response?.data || err.message, err.code);
      if (err.code === 'unauthenticated') {
        res.status(401).json({ error: 'Unauthorized' });
      } else if (err.response?.status === 404) {
        res.status(404).json({ error: 'Bill not found via API' });
      } else {
        res.status(500).json({ error: 'Error fetching bill detail' });
      }
    }
  }); 
});

/**
 * Save favorite bill for authenticated user
 */
exports.saveFavorite = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // REMOVED Manual CORS headers
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }
    try {
      const decodedToken = await verifyFirebaseToken(req);
      const userId = decodedToken.uid;
      const billData = req.body; // Expects bill summary data from frontend

      if (!billData || !billData.id) { // Use the unique ID generated by searchBills
        return res.status(400).json({ error: 'Missing bill data or bill ID in request body.' });
      }

      const userDocRef = db.collection('users').doc(userId);

      // Use a transaction to safely read and write favorites
      await db.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(userDocRef);
        let favorites = [];
        if (docSnap.exists) {
          favorites = docSnap.data().favorites || [];
        }
        // Check if bill with the same ID already exists
        const exists = favorites.some(fav => fav.id === billData.id);
        if (!exists) {
          favorites.push(billData); // Add the new favorite object
          // Set or update the document
          if (docSnap.exists) {
            transaction.update(userDocRef, { favorites: favorites });
          } else {
            // Create doc if it doesn't exist, include favorites and creation time
            transaction.set(userDocRef, { favorites: favorites, createdAt: admin.firestore.FieldValue.serverTimestamp() });
          }
          logger.info(`Saved favorite ${billData.id} for user ${userId}.`);
        } else {
          logger.info(`Duplicate favorite ${billData.id} not added for user ${userId}.`);
        }
      });

      res.status(200).json({ message: 'Favorite saved successfully.' });

    } catch (err) {
      logger.error('saveFavorite error:', err.code === 'unauthenticated' ? err.message : err);
      const status = err.code === 'unauthenticated' ? 401 : 500;
      res.status(status).json({ error: err.code === 'unauthenticated' ? 'Unauthorized' : 'Failed to save favorite.' });
    }
  }); // End corsHandler
});

/**
 * Get favorites for authenticated user
 */
exports.getFavorites = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // REMOVED Manual CORS headers
    try {
      const decodedToken = await verifyFirebaseToken(req);
      const userId = decodedToken.uid;
      const userDocRef = db.collection('users').doc(userId);
      const docSnap = await userDocRef.get();

      let favorites = [];
      if (docSnap.exists) {
        favorites = docSnap.data().favorites || [];
        logger.info(`Retrieved ${favorites.length} favorites for user ${userId}.`);
      } else {
        logger.info(`No user document found for ${userId}. Returning empty favorites.`);
      }
      res.status(200).json({ favorites }); // Always return favorites array (empty if none)

    } catch (err) {
      logger.error('getFavorites error:', err.code === 'unauthenticated' ? err.message : err);
      const status = err.code === 'unauthenticated' ? 401 : 500;
      res.status(status).json({ error: err.code === 'unauthenticated' ? 'Unauthorized' : 'Failed to fetch favorites.' });
    }
  }); // End corsHandler
});

/**
 * Get profile for authenticated user (Firestore data + Auth email)
 */
exports.getProfile = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // REMOVED Manual CORS headers
    try {
      const decodedToken = await verifyFirebaseToken(req);
      const userId = decodedToken.uid;
      const userDocRef = db.collection('users').doc(userId);
      const docSnap = await userDocRef.get();

      let profileData = { uid: userId, email: decodedToken.email }; // Base profile from auth

      if (docSnap.exists) {
        logger.info(`Retrieved Firestore profile for user ${userId}.`);
        const firestoreData = docSnap.data();
        delete firestoreData.favorites; // Explicitly remove favorites
        profileData = { ...firestoreData, ...profileData }; // Merge Firestore data, auth email takes precedence if exists
      } else {
        logger.info(`No Firestore profile document found for ${userId}. Returning auth info only.`);
      }
      res.status(200).json(profileData);

    } catch (err) {
      logger.error('getProfile error:', err.code === 'unauthenticated' ? err.message : err);
      const status = err.code === 'unauthenticated' ? 401 : 500;
      res.status(status).json({ error: err.code === 'unauthenticated' ? 'Unauthorized' : 'Failed to fetch profile.' });
    }
  }); // End corsHandler
});



const openai = new OpenAI({

    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    apiKey: getOpenaiApiKey(),
});

exports.getOpenAIReply = functions.https.onRequest(async (req, res) => {
    // --- CORS Handling ---
    res.set('Access-Control-Allow-Origin', '*'); // Allow requests from any origin (Adjust for production!)
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { billText, messages } = req.body;

    if (!openai.apiKey) {
        console.error("OpenAI API Key is not configured.");
        return res.status(500).json({ error: 'Server configuration error.' });
    }

    if (!billText || typeof billText !== 'string' || !messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Missing or invalid parameters: "billText" (string) and "messages" (array) are required.' });
    }

    const systemPrompt = {
        role: 'system',
        content: `You are a helpful assistant specialized in explaining legislative documents. Analyze the following bill text and answer the user's questions based ONLY on this text unless explicitly asked for general knowledge clarification. Be clear and concise.\n\nBILL TEXT:\n"""\n${billText}\n"""`
    };

    const messagesForAPI = [
        systemPrompt,
        ...messages
    ];

    const MAX_HISTORY_LENGTH = 10;
    if (messagesForAPI.length > MAX_HISTORY_LENGTH + 1) {
        messagesForAPI.splice(1, messagesForAPI.length - (MAX_HISTORY_LENGTH + 1));
        console.log(`Trimmed message history to ${messagesForAPI.length - 1} messages (excluding system prompt)`);
    }

    try {
        console.log(`Calling OpenAI with ${messagesForAPI.length} messages...`);
        const completion = await openai.chat.completions.create({
            // model: "gpt-3.5-turbo",
            model: "gemini-2.0-flash-lite",
            messages: messagesForAPI,
        });

        const assistantReply = completion.choices[0]?.message?.content;

        if (!assistantReply) {
            console.error("OpenAI response missing content:", completion);
            throw new Error("No content received from AI assistant.");
        }

        res.status(200).json({ reply: assistantReply.trim() });

    } catch (error) {
        console.error("Error calling OpenAI API:", error.response ? error.response.data : error.message);
        let statusCode = 500;
        let errorMessage = 'Failed to get response from AI assistant.';

        if (error.response) {
            statusCode = error.response.status || 500;
            errorMessage = error.response.data?.error?.message || errorMessage;
        } else if (error.code === 'insufficient_quota') {
            statusCode = 429;
            errorMessage = 'API quota exceeded.';
        } else if (error.message && error.message.includes('context_length_exceeded')) {
            statusCode = 400;
            errorMessage = 'Input text or conversation history is too long for the AI model.';
        }

        res.status(statusCode).json({ error: errorMessage });
    }
});

// === CSV Processing Function ===
const TARGET_BUCKET = "legal-text-aggregator.appspot.com";
const TARGET_FOLDER = "bill_csv_uploads/";
const TARGET_COLLECTION = "bills";

exports.processBillCsv = onObjectFinalized(
    {
        bucket: TARGET_BUCKET, 
    },
    async (event) => {
        const fileObject = event.data;
        const filePath = fileObject.name;
        const bucketName = fileObject.bucket;

        // --- Basic Validation ---
        if (!filePath) { console.log('No filePath.'); return null; }
        if (!filePath.startsWith(TARGET_FOLDER)) { console.log('Not in target folder.'); return null; }
        if (!filePath.toLowerCase().endsWith(".csv")) { console.log('Not a CSV.'); return null; }
        if (path.basename(filePath).startsWith('processed_')) { console.log('Already processed.'); return null; }

        // --- Stream and Parse CSV ---
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(filePath);
        const parser = parse({ columns: true, skip_empty_lines: true, trim: true, relax_column_count: true, bom: true });
        const billsArray = [];

        // Helper: Estimate chunk size (400 is safe for most bill objects)
        const CHUNK_SIZE = 400;

        return new Promise((resolve, reject) => {
            file.createReadStream()
                .pipe(parser)
                .on("data", (record) => {
                    try {
                        if (!record['Legislation Number'] || !record['Congress']) return;
                        const legNum = record['Legislation Number'].replace(/\./g, '');
                        const congressNum = (record['Congress'].match(/\d+/) || [''])[0];
                        const docId = `${congressNum}-${legNum}`;

                        // Collect cosponsors and subjects and related fields
                        const cosponsors = [];
                        const subjects = [];
                        const relatedBills = [];
                        const relatedBillRelationships = [];
                        const relatedBillLatestActions = [];
                        for (const key in record) {
                          if (key.startsWith('Cosponsor') && record[key]) cosponsors.push(record[key]);
                          if (key.startsWith('Subject') && record[key]) subjects.push(record[key]);
                          if (key.startsWith('Related Bill Relationships Identified by') && record[key]) relatedBillRelationships.push(record[key]);
                          if (key.startsWith('Related Bill Latest Action') && record[key]) relatedBillLatestActions.push(record[key]);
                          if (key.startsWith('Related Bill') && record[key]) relatedBills.push(record[key]);
                        }

                        // Parse dates
                        let introDate = null;
                        try { introDate = record['Date of Introduction'] ? Timestamp.fromDate(new Date(record['Date of Introduction'])) : null; } catch {}
                        let latestDate = null;
                        try { latestDate = record['Latest Action Date'] ? Timestamp.fromDate(new Date(record['Latest Action Date'])) : null; } catch {}
                        let dateOffered = null;
                        try { dateOffered = record['Date Offered'] ? Timestamp.fromDate(new Date(record['Date Offered'])) : null; } catch {}
                        let dateSubmitted = null;
                        try { dateSubmitted = record['Date Submitted'] ? Timestamp.fromDate(new Date(record['Date Submitted'])) : null; } catch {}
                        let dateProposed = null;
                        try { dateProposed = record['Date Proposed'] ? Timestamp.fromDate(new Date(record['Date Proposed'])) : null; } catch {}

                        const billData = {
                          id: docId,
                          legislationNumber: record['Legislation Number'] || null,
                          url: record['URL'] || null,
                          congress: parseInt(congressNum, 10) || null,
                          title: record['Title'] || null,
                          sponsor: { name: record['Sponsor'] || null, party: record['Party of Sponsor'] || null },
                          dateIntroduced: introDate,
                          committees: record['Committees'] || null,
                          latestAction: { text: record['Latest Action'] || null, date: latestDate },
                          numberOfCosponsors: parseInt(record['Number of Cosponsors'], 10) || 0,
                          cosponsors,
                          subjects,
                          numberOfRelatedBills: parseInt(record['Number of Related Bills'], 10) || relatedBills.length || 0,
                          relatedBills,
                          relatedBillRelationships,
                          relatedBillLatestActions,
                          latestSummary: record['Latest Summary'] || null,
                          amendsBill: record['Amends Bill'] || null,
                          dateOffered,
                          dateSubmitted,
                          dateProposed,
                          amendmentTextLatest: record['Amendment Text Latest'] || null,
                          amendsAmendment: record['Amends Amendment'] || null
                        };

                        billsArray.push(billData);
                    } catch (err) {
                        console.error('Record processing error:', err);
                    }
                })
                .on("end", async () => {
                    try {
                        // --- Split billsArray into chunks and write each as aggregate_N ---
                        let chunkIndex = 1;
                        for (let i = 0; i < billsArray.length; i += CHUNK_SIZE) {
                            const chunk = billsArray.slice(i, i + CHUNK_SIZE);
                            const aggregateDocRef = admin.firestore().collection(TARGET_COLLECTION).doc(`aggregate_${chunkIndex}`);
                            await aggregateDocRef.set({ bills: chunk });
                            chunkIndex++;
                        }
                        console.log(`Processed and stored ${billsArray.length} bills in ${chunkIndex-1} aggregate docs.`);
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                })
                .on("error", (err) => {
                    console.error(`Stream error: ${err}`);
                    reject(err);
                });
        });
    }
);