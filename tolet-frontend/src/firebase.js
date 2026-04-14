// Import core
import { initializeApp } from "firebase/app";

// Import services you need
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your config
const firebaseConfig = {
  apiKey: "AIzaSyAKRfIHqe6QnDV--woSe0HUKsfpePRh9MM",
  authDomain: "tolet-93a02.firebaseapp.com",
  projectId: "tolet-93a02",
  storageBucket: "tolet-93a02.firebasestorage.app",
  messagingSenderId: "791007928946",
  appId: "1:791007928946:web:38e2ce950830126fbc58eb"
};

// Initialize app
initializeApp(firebaseConfig);

// Export services ✅
export const auth = getAuth();
export const db = getFirestore();