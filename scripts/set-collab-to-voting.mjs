import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const nodeModulesPath = resolve(process.cwd(), 'make-tune3-react', 'node_modules');
const require = createRequire(pathToFileURL(nodeModulesPath + '/').href);

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, Timestamp } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDI7qgK0u9rfCkB2o3tKdwZxeVzW2YN93Q",
  authDomain: "make-tunes.firebaseapp.com",
  projectId: "make-tunes",
  storageBucket: "make-tunes.firebasestorage.app",
  messagingSenderId: "529897726529",
  appId: "1:529897726529:web:bb5f8fdc5f94e1c2ec12a1"
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

