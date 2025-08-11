import { readFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

// read environment variables from make-tune3-react/.env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../make-tune3-react/.env.local');

let firebaseConfig = {};
try {
  const envContent = readFileSync(envPath, 'utf8');
  const envVars = envContent.split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (!key || !value) return acc;
    acc[key.trim()] = value.trim();
    return acc;
  }, {});
  firebaseConfig = {
    apiKey: envVars.VITE_FIREBASE_API_KEY,
    authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: envVars.VITE_FIREBASE_PROJECT_ID,
    storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: envVars.VITE_FIREBASE_APP_ID
  };
} catch (error) {
  console.error('error reading .env.local from make-tune3-react:', error);
  process.exit(1);
}

// resolve firebase modules from make-tune3-react's node_modules
const requireFromReact = createRequire(join(__dirname, '../make-tune3-react/package.json'));
const appEntry = requireFromReact.resolve('firebase/app');
const firestoreEntry = requireFromReact.resolve('firebase/firestore');
const { initializeApp } = await import(pathToFileURL(appEntry).href);
const { getFirestore, collection, getDocs, deleteDoc, doc } = await import(pathToFileURL(firestoreEntry).href);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearCollection(name) {
  const snap = await getDocs(collection(db, name));
  const ids = snap.docs.map(d => d.id);
  console.log(`deleting ${ids.length} from ${name}...`);
  for (const id of ids) {
    await deleteDoc(doc(db, name, id));
  }
}

async function run() {
  console.log('clearing database (keeping users)...');
  // do not remove users per requirements
  const collectionsToClear = [
    'projects',
    'collaborations',
    'userCollaborations',
    'submissionUsers',
    'projectNameIndex'
  ];
  for (const name of collectionsToClear) {
    await clearCollection(name).catch(err => {
      console.error(`failed clearing ${name}:`, err);
    });
  }
  console.log('done.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

