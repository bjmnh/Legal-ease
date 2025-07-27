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
// New requirement for accessing secrets
const { defineString } = require('firebase-functions/params');

// --- Define secrets as environment parameters ---
const congressApiKey = defineString('CONGRESS_API_KEY');
// Renamed to be more accurate since it's for Google's Gemini model
const geminiApiKey = defineString('GEMINI_API_KEY');

// Initialize admin SDK ONCE at the top level
initializeApp();

const db = getFirestore();
const storage = getStorage();

// Initialize CORS handler
const corsHandler = cors({
  origin: true, // In production, restrict this: origin: ['https://your-app-domain.com']
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// --- Helper Functions ---

function getCongressApiKey() {
    const key = congressApiKey.value();
    if (!key) {
        logger.error('Missing CONGRESS_API_KEY secret. Set it with `firebase functions:secrets:set CONGRESS_API_KEY`');
        throw new Error('Server configuration error: Missing API key.');
  }
  return key;
}

function getGeminiApiKey(){
    const key = geminiApiKey.value();
    if (!key) {
        logger.error('Missing GEMINI_API_KEY secret. Set it with `firebase functions:secrets:set GEMINI_API_KEY`');
        throw new Error('Server configuration error: Missing API key.');
    }
    return key;
}

async function verifyFirebaseToken(req) {
    const authorizationHeader = req.headers.authorization || '';
    if (!authorizationHeader.startsWith('Bearer ')) {
        logger.warn('verifyFirebaseToken: No Bearer token found.');
        const error = new Error('Unauthorized: No token provided.');
        error.code = 'unauthenticated';
        throw error;
    }
    
    const idToken = authorizationHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        logger.info('verifyFirebaseToken: Token verified for UID:', decodedToken.uid);
        return decodedToken;
    } catch (error) {
        logger.error('verifyFirebaseToken: Error verifying token:', error);
        const err = new Error('Unauthorized: Invalid or expired token.');
        err.code = 'unauthenticated';
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

      let textHtml = '';
      let textPlain = '';
      let amendmentList = [];

      // Fetch Bill Text
      if (bill.textVersions?.url) {
        try {
          const textVersionsListUrl = `${bill.textVersions.url}${bill.textVersions.url.includes('?') ? '&' : '?'}api_key=${key}`;
          const textListResp = await axios.get(textVersionsListUrl);
          let formats = textListResp.data.textVersions?.[0]?.formats || [];
          const formatOrder = [ { type: 'Plain Text', prop: 'textPlain' }, { type: 'Formatted Text', prop: 'textHtml' } ];

          for (const pref of formatOrder) {
            const foundFormat = formats.find(f => f.type === pref.type && f.url);
            if (foundFormat) {
              try {
                const formatUrl = `${foundFormat.url}${foundFormat.url.includes('?') ? '&' : '?'}api_key=${key}`;
                logger.info(`Fetching text format ${pref.type} from ${formatUrl.replace(key, '***')}`);
                const textContentResp = await axios.get(formatUrl);
                let rawText = textContentResp.data;

                if (pref.type === 'Formatted Text') {
                  const match = String(rawText).match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
                  if (match && match[1]) {
                    logger.info(`Extracted text from <pre> tag for ${congress}-${type}-${number}`);
                    textPlain = match[1].trim();
                    textHtml = '';
                    break;
                  } else {
                    logger.info(`Sanitizing Formatted Text for ${congress}-${type}-${number}`);
                    textHtml = sanitizeHtml(rawText, {
                      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'ul', 'ol', 'li', 'pre', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td']),
                      allowedAttributes: { 'a': ['href'], 'img': ['src', 'alt'] },
                    });
                    textPlain = '';
                  }
                } else if (pref.type === 'Plain Text') {
                  textPlain = rawText;
                  textHtml = '';
                }
                if (textHtml || textPlain) {
                  logger.info(`Successfully fetched bill text as ${pref.type} for ${congress}-${type}-${number}`);
                  break;
                }
              } catch (fetchErr) {
                logger.warn(`Failed to fetch/process bill text as ${pref.type} for ${congress}-${type}-${number}:`, fetchErr.message);
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
          amendmentList = (amendResp.data.amendments || []).map(a => ({
            number: a.number, type: a.type, purpose: a.purpose, description: a.description,
            latestActionDate: a.latestAction?.actionDate || '', latestActionText: a.latestAction?.text || '', url: a.url
          }));
          logger.info(`Found ${amendmentList.length} amendments for ${congress}-${type}-${number}`);
        } catch (err) {
          logger.error(`Error fetching amendments for ${congress}-${type}-${number}:`, err.message);
        }
      }

      const meta = {
        identifier: `${bill.type || 'N/A'} ${bill.number || 'N/A'}`, congress: bill.congress ? `${bill.congress}th Congress` : 'N/A',
        title: bill.title || 'No Title Available', status: bill.latestAction?.text || 'Status not available',
        sponsor: bill.sponsors?.[0]?.name || 'N/A', sponsorParty: bill.sponsors?.[0]?.party || 'N/A',
        sponsorState: bill.sponsors?.[0]?.state || 'N/A', sponsorDistrict: bill.sponsors?.[0]?.district || 'N/A',
        introducedDate: bill.introducedDate || 'N/A',
        lastAction: { date: bill.latestAction?.actionDate || 'N/A', description: bill.latestAction?.text || 'No recent action' },
        keyText: textPlain ? (textPlain.length > 300 ? textPlain.slice(0, 300) + '...' : textPlain) : 'Key text not available',
      };

      const responseToCache = { textHtml, textPlain, meta, amendmentList };
      await cacheRef.set({ billDetail: responseToCache, timestamp: Date.now() });
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
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }
    try {
      const decodedToken = await verifyFirebaseToken(req);
      const userId = decodedToken.uid;
      const billData = req.body;

      if (!billData || !billData.id) {
        return res.status(400).json({ error: 'Missing bill data or bill ID in request body.' });
      }

      const userDocRef = db.collection('users').doc(userId);
      await db.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(userDocRef);
        let favorites = docSnap.exists ? (docSnap.data().favorites || []) : [];
        const exists = favorites.some(fav => fav.id === billData.id);
        if (!exists) {
          favorites.push(billData);
          if (docSnap.exists) {
            transaction.update(userDocRef, { favorites: favorites });
          } else {
            transaction.set(userDocRef, { favorites: favorites, createdAt: FieldValue.serverTimestamp() });
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
  });
});

/**
 * Get favorites for authenticated user
 */
exports.getFavorites = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const decodedToken = await verifyFirebaseToken(req);
      const userId = decodedToken.uid;
      const userDocRef = db.collection('users').doc(userId);
      const docSnap = await userDocRef.get();
      const favorites = docSnap.exists ? (docSnap.data().favorites || []) : [];
      logger.info(`Retrieved ${favorites.length} favorites for user ${userId}.`);
      res.status(200).json({ favorites });
    } catch (err) {
      logger.error('getFavorites error:', err.code === 'unauthenticated' ? err.message : err);
      const status = err.code === 'unauthenticated' ? 401 : 500;
      res.status(status).json({ error: err.code === 'unauthenticated' ? 'Unauthorized' : 'Failed to fetch favorites.' });
    }
  });
});

/**
 * Get profile for authenticated user (Firestore data + Auth email)
 */
exports.getProfile = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const decodedToken = await verifyFirebaseToken(req);
      const userId = decodedToken.uid;
      const userDocRef = db.collection('users').doc(userId);
      const docSnap = await userDocRef.get();
      let profileData = { uid: userId, email: decodedToken.email };
      if (docSnap.exists) {
        logger.info(`Retrieved Firestore profile for user ${userId}.`);
        const firestoreData = docSnap.data();
        delete firestoreData.favorites;
        profileData = { ...firestoreData, ...profileData };
      } else {
        logger.info(`No Firestore profile document found for ${userId}. Returning auth info only.`);
      }
      res.status(200).json(profileData);
    } catch (err) {
      logger.error('getProfile error:', err.code === 'unauthenticated' ? err.message : err);
      const status = err.code === 'unauthenticated' ? 401 : 500;
      res.status(status).json({ error: err.code === 'unauthenticated' ? 'Unauthorized' : 'Failed to fetch profile.' });
    }
  });
});

// --- Generative AI Function (Renamed for Clarity) ---

const generativeAIClient = new OpenAI({
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    apiKey: getGeminiApiKey(),
});

exports.getGenerativeAIReply = functions.https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        try {
            // Secure this endpoint by requiring authentication
            await verifyFirebaseToken(req);

            if (req.method !== 'POST') {
                return res.status(405).json({ error: 'Method Not Allowed' });
            }

            const { billText, messages } = req.body;

            if (!getGeminiApiKey()) {
                // This check is now inside the helper, but an extra one doesn't hurt.
                logger.error("Gemini API Key is not configured.");
                return res.status(500).json({ error: 'Server configuration error.' });
            }
        
            if (!billText || typeof billText !== 'string' || !messages || !Array.isArray(messages)) {
                return res.status(400).json({ error: 'Missing or invalid parameters: "billText" (string) and "messages" (array) are required.' });
            }

            const systemPrompt = {
                role: 'system',
                content: `You are a helpful assistant specialized in explaining legislative documents. Analyze the following bill text and answer the user's questions based ONLY on this text unless explicitly asked for general knowledge clarification. Be clear and concise.\n\nBILL TEXT:\n"""\n${billText}\n"""`
            };
        
            const messagesForAPI = [ systemPrompt, ...messages ];
        
            const MAX_HISTORY_LENGTH = 10;
            if (messagesForAPI.length > MAX_HISTORY_LENGTH + 1) { // +1 for the system prompt
                messagesForAPI.splice(1, messagesForAPI.length - (MAX_HISTORY_LENGTH + 1));
                logger.info(`Trimmed message history to ${messagesForAPI.length - 1} messages.`);
            }

            logger.info(`Calling Generative AI with ${messagesForAPI.length} messages...`);
            const completion = await generativeAIClient.chat.completions.create({
                model: "gemini-2.0-flash-lite", // Using Gemini model
                messages: messagesForAPI,
            });
        
            const assistantReply = completion.choices[0]?.message?.content;
        
            if (!assistantReply) {
                logger.error("Generative AI response missing content:", completion);
                throw new Error("No content received from AI assistant.");
            }
        
            res.status(200).json({ reply: assistantReply.trim() });

        } catch (error) {
            logger.error("Error calling Generative AI API:", {
                message: error.message,
                code: error.code,
                response: error.response?.data
            });
        
            if (error.code === 'unauthenticated') {
              return res.status(401).json({ error: 'Unauthorized' });
            }

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
});


// === CSV Processing Function ===
const TARGET_BUCKET = "legal-text-aggregator.appspot.com";
const TARGET_FOLDER = "bill_csv_uploads/";
const TARGET_COLLECTION = "bills";

exports.processBillCsv = onObjectFinalized({ bucket: TARGET_BUCKET }, async (event) => {
    const fileObject = event.data;
    const filePath = fileObject.name;
    const bucketName = fileObject.bucket;

    if (!filePath || !filePath.startsWith(TARGET_FOLDER) || !filePath.toLowerCase().endsWith(".csv") || path.basename(filePath).startsWith('processed_')) {
        logger.info('Skipping file based on validation rules.', { path: filePath });
        return null;
    }

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);
    const parser = parse({ columns: true, skip_empty_lines: true, trim: true, relax_column_count: true, bom: true });
    const billsArray = [];
    const CHUNK_SIZE = 400;

    return new Promise((resolve, reject) => {
        file.createReadStream()
            .pipe(parser)
            .on("data", (record) => {
                try {
                    if (!record['Legislation Number'] || !record['Congress']) return;
                    const legNum = record['Legislation Number'].replace(/\./g, '');
                    const congressNum = (record['Congress'].match(/\d+/) || [''])[0];
                    if (!congressNum || !legNum) return; // Skip if we can't form a valid ID
                    const docId = `${congressNum}-${legNum}`;

                    const cosponsors = [], subjects = [], relatedBills = [], relatedBillRelationships = [], relatedBillLatestActions = [];
                    for (const key in record) {
                      if (key.startsWith('Cosponsor') && record[key]) cosponsors.push(record[key]);
                      if (key.startsWith('Subject') && record[key]) subjects.push(record[key]);
                      if (key.startsWith('Related Bill Relationships Identified by') && record[key]) relatedBillRelationships.push(record[key]);
                      if (key.startsWith('Related Bill Latest Action') && record[key]) relatedBillLatestActions.push(record[key]);
                      if (key.startsWith('Related Bill') && record[key]) relatedBills.push(record[key]);
                    }

                    const billData = {
                      id: docId,
                      legislationNumber: record['Legislation Number'] || null, url: record['URL'] || null,
                      congress: parseInt(congressNum, 10) || null, title: record['Title'] || null,
                      sponsor: { name: record['Sponsor'] || null, party: record['Party of Sponsor'] || null },
                      dateIntroduced: record['Date of Introduction'] ? Timestamp.fromDate(new Date(record['Date of Introduction'])) : null,
                      committees: record['Committees'] || null,
                      latestAction: { text: record['Latest Action'] || null, date: record['Latest Action Date'] ? Timestamp.fromDate(new Date(record['Latest Action Date'])) : null },
                      numberOfCosponsors: parseInt(record['Number of Cosponsors'], 10) || 0, cosponsors, subjects,
                      numberOfRelatedBills: parseInt(record['Number of Related Bills'], 10) || relatedBills.length || 0,
                      relatedBills, relatedBillRelationships, relatedBillLatestActions,
                      latestSummary: record['Latest Summary'] || null, amendsBill: record['Amends Bill'] || null,
                      dateOffered: record['Date Offered'] ? Timestamp.fromDate(new Date(record['Date Offered'])) : null,
                      dateSubmitted: record['Date Submitted'] ? Timestamp.fromDate(new Date(record['Date Submitted'])) : null,
                      dateProposed: record['Date Proposed'] ? Timestamp.fromDate(new Date(record['Date Proposed'])) : null,
                      amendmentTextLatest: record['Amendment Text Latest'] || null, amendsAmendment: record['Amends Amendment'] || null
                    };

                    billsArray.push(billData);
                } catch (err) {
                    logger.error('Error processing a CSV record.', { error: err.message, record });
                }
            })
            .on("end", async () => {
                try {
                    if (billsArray.length === 0) {
                        logger.warn("CSV processing finished, but no valid bill records were found.", { filePath });
                        resolve();
                        return;
                    }
                    let chunkIndex = 1;
                    for (let i = 0; i < billsArray.length; i += CHUNK_SIZE) {
                        const chunk = billsArray.slice(i, i + CHUNK_SIZE);
                        // Using the consistent 'db' client
                        const aggregateDocRef = db.collection(TARGET_COLLECTION).doc(`aggregate_${chunkIndex}`);
                        await aggregateDocRef.set({ bills: chunk, createdAt: FieldValue.serverTimestamp() });
                        chunkIndex++;
                    }
                    logger.info(`Successfully processed and stored ${billsArray.length} bills in ${chunkIndex-1} aggregate docs.`, { filePath });
                    resolve();
                } catch (err) {
                    logger.error("Error writing bill chunks to Firestore.", { error: err.message, filePath });
                    reject(err);
                }
            })
            .on("error", (err) => {
                logger.error(`Error streaming or parsing CSV file.`, { error: err.message, filePath });
                reject(err);
            });
    });
});