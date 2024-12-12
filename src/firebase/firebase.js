

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {

  apiKey: "AIzaSyDihIV51M3lICX6dSKFFCU-wNdEyCO6SRw",
  authDomain: "zions-788b3.firebaseapp.com",
  projectId: "zions-788b3",
  storageBucket: "zions-788b3.appspot.com",
  messagingSenderId: "417678721325",
  appId: "1:417678721325:web:052612c91c66cd0d8e53a4",
  measurementId: "G-P5N0KBS3F1"

};


const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);


export { db, storage, auth };
