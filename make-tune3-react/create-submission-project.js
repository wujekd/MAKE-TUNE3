import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// read env from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '.env.local');

let firebaseConfig = {};
try {
  const envContent = readFileSync(envPath, 'utf8');
  const envVars = envContent.split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) acc[key.trim()] = value.trim();
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
  console.error('error reading .env.local:', error);
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createSubmissionProject() {
  console.log('creating submission-phase project...');

  // demo user
  const demoUserId = 've8DfsfgtjbCV9MdWyCwwwtqCf02';

  // ensure user exists (idempotent)
  const userProfile = {
    uid: demoUserId,
    email: 'dom.wujek@gmail.com',
    createdAt: Timestamp.now(),
    collaborationIds: []
  };
  await setDoc(doc(db, 'users', demoUserId), userProfile, { merge: true });

  // project
  const projectData = {
    name: 'Submission Project',
    description: 'project with a live submission phase',
    ownerId: demoUserId,
    isActive: true,
    pastCollaborations: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  const projectRef = await addDoc(collection(db, 'projects'), projectData);
  const projectId = projectRef.id;
  console.log(' project:', projectId);

  // collaboration in submission phase
  const collaborationData = {
    projectId,
    name: 'New Submission Round',
    description: 'upload your best take',
    backingTrackPath: '',
    submissionPaths: [],
    submissionDuration: 7 * 24 * 60 * 60,
    votingDuration: 7 * 24 * 60 * 60,
    status: 'submission',
    publishedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  const collabRef = await addDoc(collection(db, 'collaborations'), collaborationData);
  const collaborationId = collabRef.id;
  console.log(' collaboration:', collaborationId);

  // attach to user profile list
  await setDoc(doc(db, 'users', demoUserId), {
    collaborationIds: [collaborationId]
  }, { merge: true });

  console.log('done');
  return { projectId, collaborationId };
}

createSubmissionProject()
  .then((res) => {
    console.log('result:', res);
  })
  .catch((err) => {
    console.error('failed:', err);
    process.exit(1);
  });

