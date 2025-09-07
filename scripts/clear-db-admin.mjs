import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// resolve firebase-admin from functions' node_modules to avoid extra root install
const requireFromFunctions = createRequire(join(__dirname, '../functions/package.json'));
const adminAppEntry = requireFromFunctions.resolve('firebase-admin/app');
const adminFsEntry = requireFromFunctions.resolve('firebase-admin/firestore');

const { initializeApp, applicationDefault } = await import(pathToFileURL(adminAppEntry).href);
const { getFirestore } = await import(pathToFileURL(adminFsEntry).href);

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function deleteCollection(name) {
  console.log(`deleting all documents from ${name}...`);
  const writer = db.bulkWriter();
  let total = 0;
  let lastDoc = null;
  while (true) {
    let q = db.collection(name).orderBy('__name__').limit(500);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      writer.delete(d.ref);
      total++;
      lastDoc = d;
    }
    // flush intermittently to avoid memory growth
    await writer.flush();
    if (snap.size < 500) break;
  }
  await writer.close();
  console.log(`deleted ${total} from ${name}`);
}

async function resetUsersCollaborationIds() {
  console.log('resetting users.collaborationIds to [] ...');
  const writer = db.bulkWriter();
  let total = 0;
  let lastDoc = null;
  while (true) {
    let q = db.collection('users').orderBy('__name__').limit(500);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      writer.update(d.ref, { collaborationIds: [] });
      total++;
      lastDoc = d;
    }
    await writer.flush();
    if (snap.size < 500) break;
  }
  await writer.close();
  console.log(`reset collaborationIds for ${total} users`);
}

async function run() {
  console.log('Starting admin database clear (preserve users and usernames)...');
  const collectionsToClear = [
    'projects',
    'collaborations',
    'userCollaborations',
    'submissionUsers',
    'projectNameIndex'
  ];
  for (const name of collectionsToClear) {
    try {
      await deleteCollection(name);
    } catch (e) {
      console.error(`failed deleting ${name}:`, e);
    }
  }
  try {
    await resetUsersCollaborationIds();
  } catch (e) {
    console.error('failed resetting users.collaborationIds:', e);
  }
  console.log('Done.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});