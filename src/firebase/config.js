import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAf_nuzz0mrGARbMmOcFQDr_m6afIG1C3o",
  authDomain: "admincashier.firebaseapp.com",
  projectId: "admincashier",
  storageBucket: "admincashier.firebasestorage.app",
  messagingSenderId: "765333587089",
  appId: "1:765333587089:web:cdd675227b2d1159c3ab30",
  measurementId: "G-JH8P8HDNCM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const functions = getFunctions(app);

export { db, auth, storage, functions };