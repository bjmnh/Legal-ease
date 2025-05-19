import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import MainContent from './components/MainContent';
import FloatingActionBar from './components/FloatingActionBar';
import LandingPage from './components/LandingPage';
import { auth, db } from './firebase';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getDoc, doc } from 'firebase/firestore';
import './index.css';

// Cloud Function URL for detailed view
const GET_BILL_DETAIL_URL = import.meta.env.VITE_GET_BILL_DETAIL_URL || 'https://getbilldetail-xa3z7rijfa-uc.a.run.app';

function App() {
  const [allBills, setAllBills] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedBillId, setSelectedBillId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [selectedBillDetail, setSelectedBillDetail] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const selectedBill = results.find(bill => bill.id === selectedBillId);
  const provider = new GoogleAuthProvider();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => setCurrentUser(user));
    return unsubscribe;
  }, []);

  useEffect(() => {
    async function fetchBills() {
      try {
        // Fetch all aggregate docs (aggregate_1, aggregate_2, ...) and merge
        let allBills = [];
        let chunkIndex = 1;
        while (true) {
          const aggregateDoc = await getDoc(doc(db, "bills", `aggregate_${chunkIndex}`));
          if (!aggregateDoc.exists()) break;
          const billsList = aggregateDoc.data().bills || [];
          allBills = allBills.concat(billsList);
          chunkIndex++;
        }
        if (allBills.length === 0) {
          setAllBills([]);
          setResults([]);
          setSelectedBillId(null);
          return;
        }
        setAllBills(allBills.map(bill => {
          const [congressStr, rawLegNum] = bill.id.split('-', 2);
          const cleaned = rawLegNum.replace(/[^a-zA-Z0-9\s]|_/g, '').replace(/\s+/g, ' ').trim();
          const [typeLetters, num] = cleaned.split(' ');
          const type = typeLetters?.toLowerCase?.() || '';
          const number = num;
          // --- Convert Firestore Timestamps to readable strings ---
          const introducedDate = (bill.dateIntroduced && bill.dateIntroduced.seconds)
            ? new Date(bill.dateIntroduced.seconds * 1000).toLocaleDateString()
            : bill.dateIntroduced || 'N/A';
          const lastActionDate = (bill.latestAction?.date && bill.latestAction.date.seconds)
            ? new Date(bill.latestAction.date.seconds * 1000).toLocaleDateString()
            : bill.latestAction?.date || 'N/A';
          return {
            id: bill.id,
            identifier: bill.legislationNumber,
            introducedDate,
            congress: `${congressStr}th Congress`,
            hasKeyText: false,
            title: bill.title,
            sponsor: {
              name: bill.sponsor?.name || 'N/A',
              party: bill.sponsor?.party || 'N/A',
              state: bill.sponsor?.state || 'N/A',
              district: bill.sponsor?.district || 'N/A',
              dems: bill.numberOfCosponsors || 0,
              reps: 0
            },
            lastAction: {
              date: lastActionDate,
              description: bill.latestAction?.text || 'No recent action'
            },
            fetchParams: { congress: congressStr, type, number }
          };
        }));
        setResults(allBills.map(bill => {
          const [congressStr, rawLegNum] = bill.id.split('-', 2);
          const cleaned = rawLegNum.replace(/[^a-zA-Z0-9\s]|_/g, '').replace(/\s+/g, ' ').trim();
          const [typeLetters, num] = cleaned.split(' ');
          const type = typeLetters?.toLowerCase?.() || '';
          const number = num;
          // --- Convert Firestore Timestamps to readable strings ---
          const introducedDate = (bill.dateIntroduced && bill.dateIntroduced.seconds)
            ? new Date(bill.dateIntroduced.seconds * 1000).toLocaleDateString()
            : bill.dateIntroduced || 'N/A';
          const lastActionDate = (bill.latestAction?.date && bill.latestAction.date.seconds)
            ? new Date(bill.latestAction.date.seconds * 1000).toLocaleDateString()
            : bill.latestAction?.date || 'N/A';
          return {
            id: bill.id,
            identifier: bill.legislationNumber,
            introducedDate,
            congress: `${congressStr}th Congress`,
            hasKeyText: false,
            title: bill.title,
            sponsor: {
              name: bill.sponsor?.name || 'N/A',
              party: bill.sponsor?.party || 'N/A',
              state: bill.sponsor?.state || 'N/A',
              district: bill.sponsor?.district || 'N/A',
              dems: bill.numberOfCosponsors || 0,
              reps: 0
            },
            lastAction: {
              date: lastActionDate,
              description: bill.latestAction?.text || 'No recent action'
            },
            fetchParams: { congress: congressStr, type, number }
          };
        }));
        setSelectedBillId(allBills[0]?.id || null);
      } catch (err) {
        console.error("Error loading bills:", err);
      }
    }
    fetchBills();
  }, [currentUser]);

  const handleSignIn = () => signInWithPopup(auth, provider).catch(err => setAuthError(err.message));

  const handleEmailSignIn = async () => {
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleSignUpEmail = async () => {
    setAuthError('');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleSignOut = () => signOut(auth).catch(err => setAuthError(err.message));

  const onSubmitSearch = () => {
    const filtered = allBills.filter(bill => 
      bill.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.identifier.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setResults(filtered);
    setSelectedBillId(filtered[0]?.id || null);
  };

  // Live search: update results whenever searchQuery or allBills change
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setResults(allBills);
      setSelectedBillId(allBills[0]?.id || null);
    } else {
      const filtered = allBills.filter(bill =>
        bill.title.toLowerCase().includes(q) ||
        bill.identifier.toLowerCase().includes(q)
      );
      setResults(filtered);
      setSelectedBillId(filtered[0]?.id || null);
    }
  }, [searchQuery, allBills]);

  useEffect(() => {
    if (!currentUser) return;
    setSelectedBillDetail(null);
    if (selectedBill?.fetchParams) {
      const { congress, type, number } = selectedBill.fetchParams;
      setIsDetailLoading(true);
      (async () => {
        try {
          const token = await currentUser.getIdToken();
          const resp = await fetch(
            `${GET_BILL_DETAIL_URL}?congress=${congress}&type=${type}&number=${number}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const detailData = await resp.json();

          setSelectedBillDetail({
            ...detailData,
            meta: {
              ...detailData.meta,
              sponsor: selectedBill?.sponsor
            }
          });
        } catch (err) {
          setSelectedBillDetail({ error: 'Detail fetch error' });
          console.error('Detail fetch error:', err);
        } finally {
          setIsDetailLoading(false);
        }
      })();
    } else {
      setSelectedBillDetail(null);
    }
  }, [selectedBill, currentUser]);

  if (!currentUser) {
    return (
      <LandingPage
        authError={authError}
        email={email}
        password={password}
        setEmail={setEmail}
        setPassword={setPassword}
        onEmailSignIn={handleEmailSignIn}
        onEmailSignUp={handleSignUpEmail}
        onGoogleSignIn={handleSignIn}
      />
    );
  }
  
  

  return (
    <div className="flex flex-col h-full bg-white text-neutral-dark">
      {/* Header with controlled search */}
      <Header
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSubmitSearch={onSubmitSearch}
        currentUser={currentUser}
        onSignOut={handleSignOut}
      />

      {/* Main content with state props */}
      <MainContent
        results={results}
        selectedBillId={selectedBillId}
        onSelectBill={setSelectedBillId}
        selectedBill={selectedBillDetail || selectedBill}
        isDetailLoading={isDetailLoading}
      />

      {/* Placeholder for Floating Action Bar */}
      <FloatingActionBar />
    </div>
  );
}

export default App;
