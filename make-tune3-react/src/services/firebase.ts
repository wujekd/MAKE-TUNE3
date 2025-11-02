import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app: FirebaseApp;
if (process.env.NODE_ENV === 'test' && globalThis.firebaseApp) {
  app = globalThis.firebaseApp;
} else {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

export const auth = getAuth(app);

let db: Firestore;
let storage: FirebaseStorage;

if (process.env.NODE_ENV === 'test' && globalThis.firebaseDb && globalThis.firebaseStorage) {
  db = globalThis.firebaseDb;
  storage = globalThis.firebaseStorage;
} else {
  db = getFirestore(app);
  const storageBucketUrl = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ? `gs://${import.meta.env.VITE_FIREBASE_STORAGE_BUCKET}` : undefined;
  storage = storageBucketUrl ? getStorage(app, storageBucketUrl) : getStorage(app);
}

export const functions = getFunctions(app, 'europe-west1');

export { db, storage };
export default app; 