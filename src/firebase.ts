import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyCTBV-Qg8JzVMTIFjcqFGsu66jI7OvSxv0',
  authDomain: 'hiddengems-87ca5.firebaseapp.com',
  projectId: 'hiddengems-87ca5',
  storageBucket: 'hiddengems-87ca5.firebasestorage.app',
  messagingSenderId: '96601002891',
  appId: '1:96601002891:web:19214c8a158e3d0009d58e',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
