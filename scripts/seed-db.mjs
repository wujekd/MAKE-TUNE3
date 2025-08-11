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
const { getFirestore, collection, addDoc, setDoc, doc, Timestamp } = await import(pathToFileURL(firestoreEntry).href);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const OWNER_ID = 've8DfsfgtjbCV9MdWyCwwwtqCf02';

function buildProject(name, description) {
  const now = Timestamp.now();
  return {
    name,
    description,
    ownerId: OWNER_ID,
    isActive: true,
    pastCollaborations: [],
    createdAt: now,
    updatedAt: now
  };
}

function buildCollab(projectId, name, description) {
  const now = Timestamp.now();
  return {
    projectId,
    name,
    description,
    backingTrackPath: '',
    submissions: [],
    submissionDuration: 7 * 24 * 60 * 60,
    votingDuration: 3 * 24 * 60 * 60,
    status: 'unpublished',
    requiresModeration: true,
    unmoderatedSubmissions: false,
    publishedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

async function run() {
  console.log('seeding database with two projects and one collab each...');
  const p1 = await addDoc(collection(db, 'projects'), buildProject('Project Alpha', 'First demo project'));
  const p2 = await addDoc(collection(db, 'projects'), buildProject('Project Beta', 'Second demo project'));

  const c1 = await addDoc(collection(db, 'collaborations'), buildCollab(p1.id, 'Alpha Collab 1', 'Alpha initial collaboration'));
  const c2 = await addDoc(collection(db, 'collaborations'), buildCollab(p2.id, 'Beta Collab 1', 'Beta initial collaboration'));

  // add name index docs similar to unique-name workflow if needed later (optional seed)
  // await setDoc(doc(db, 'projectNameIndex', 'project-alpha'), { projectId: p1.id, ownerId: OWNER_ID, createdAt: Timestamp.now() });
  // await setDoc(doc(db, 'projectNameIndex', 'project-beta'), { projectId: p2.id, ownerId: OWNER_ID, createdAt: Timestamp.now() });

  console.log('done.');
  console.log('project1:', p1.id, '| collab:', c1.id);
  console.log('project2:', p2.id, '| collab:', c2.id);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

