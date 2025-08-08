import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, addDoc, collection, Timestamp, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// read environment variables from .env.local
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

async function run() {
  console.log('creating moderation demo...');
  const now = Timestamp.now();

  // demo user
  const demoUserId = 've8DfsfgtjbCV9MdWyCwwwtqCf02';
  await setDoc(doc(db, 'users', demoUserId), {
    uid: demoUserId,
    email: 'dom.wujek@gmail.com',
    createdAt: now,
    collaborationIds: []
  }, { merge: true });

  // project
  const projectRef = await addDoc(collection(db, 'projects'), {
    name: 'Moderation Demo Project',
    description: 'project with moderation-required collab',
    ownerId: demoUserId,
    isActive: true,
    pastCollaborations: [],
    createdAt: now,
    updatedAt: now
  });
  const projectId = projectRef.id;

  // collaboration requiring moderation
  const collaborationRef = await addDoc(collection(db, 'collaborations'), {
    projectId,
    name: 'Moderation Collab',
    description: 'collab requiring moderation',
    backingTrackPath: 'demo2%20instrumental.mp3',
    submissionPaths: [],
    submissionDuration: 7 * 24 * 60 * 60,
    votingDuration: 7 * 24 * 60 * 60,
    status: 'voting',
    requiresModeration: true,
    needsModeration: true,
    publishedAt: now,
    createdAt: now,
    updatedAt: now
  });
  const collaborationId = collaborationRef.id;

  // mock submissions using mock-audio.ts paths
  const submissionPaths = [
    'df9a07de-d40c-4e49-ab35-2c94f55e5137_phone%20from%20china.mp3',
    'voiceover2.mp3',
    'fuck_me_upppp_mh2bywZ.mp3',
    'bb_g_Ab.mp3'
  ];

  // record private submission-user mappings
  for (const fp of submissionPaths) {
    await addDoc(collection(db, 'submissionUsers'), {
      filePath: fp,
      userId: demoUserId,
      collaborationId,
      artist: 'Demo Artist',
      createdAt: now
    });
  }

  // update collaboration with submission paths
  await updateDoc(doc(db, 'collaborations', collaborationId), {
    submissionPaths,
    updatedAt: Timestamp.now()
  });

  console.log('moderation demo created');
  console.log('project:', projectId);
  console.log('collaboration:', collaborationId);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

