import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { config } from 'dotenv';

config({ path: resolve(process.cwd(), 'make-tune3-react', '.env') });

const nodeModulesPath = resolve(process.cwd(), 'make-tune3-react', 'node_modules');
const require = createRequire(pathToFileURL(nodeModulesPath + '/').href);

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, Timestamp } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const collaborationId = process.argv[2];

if (!collaborationId) {
  console.error('Usage: node set-collab-to-voting.mjs <collaborationId>');
  process.exit(1);
}

async function setToVoting() {
  try {
    const collabRef = doc(db, 'collaborations', collaborationId);
    await updateDoc(collabRef, {
      status: 'voting',
      votingStartedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    console.log(`✅ Collaboration ${collaborationId} set to voting stage`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setToVoting();

