import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  EmailAuthProvider,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDgiHXIPG94PuNCvR7r_HtDFRYlELoO3V0",
  authDomain: "grihiniapnabazaar.firebaseapp.com",
  projectId: "grihiniapnabazaar",
  storageBucket: "grihiniapnabazaar.firebasestorage.app",
  messagingSenderId: "922565846339",
  appId: "1:922565846339:web:3d4d42a6345fe68e2e7bf6",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const emailProvider = new EmailAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;