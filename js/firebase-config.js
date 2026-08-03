import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCJkP6sOu-gbZwum8vQVqllFIHgrtUxQMc",
  authDomain: "cppct-tina.firebaseapp.com",
  projectId: "cppct-tina",
  storageBucket: "cppct-tina.firebasestorage.app",
  messagingSenderId: "525781235034",
  appId: "1:525781235034:web:12a1a632f1ff97db22ef63",
};

const app = initializeApp(firebaseConfig, "membre");
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// --- Upload d'une photo de profil vers Storage, retourne l'URL publique ---
async function uploaderPhotoProfil(uid, file) {
  const chemin = `photos_profil/${uid}.jpg`;
  const storageRef = ref(storage, chemin);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

export {
  auth,
  db,
  storage,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  uploaderPhotoProfil,
};
