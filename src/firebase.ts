import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDDg_RiW9TDszcKrAlp18jbJNUpgybfXxM",
  authDomain: "hr-app-c0a12.firebaseapp.com",
  projectId: "hr-app-c0a12",
  storageBucket: "hr-app-c0a12.firebasestorage.app",
  messagingSenderId: "230219971223",
  appId: "1:230219971223:web:84ca5d399e7a687e3947d2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
