import { getFirestore, type Firestore } from 'firebase/firestore';
import app from './firebaseApp';

let db: Firestore;

if (process.env.NODE_ENV === 'test' && globalThis.firebaseDb) {
  db = globalThis.firebaseDb;
} else {
  db = getFirestore(app);
}

export { db };
export default db;
