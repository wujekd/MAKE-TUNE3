import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const requireFromFunctions = createRequire(join(__dirname, '../functions/package.json'));
const adminAppEntry = requireFromFunctions.resolve('firebase-admin/app');
const adminFsEntry = requireFromFunctions.resolve('firebase-admin/firestore');

const { initializeApp, applicationDefault } = await import(pathToFileURL(adminAppEntry).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(adminFsEntry).href);

const args = process.argv.slice(2);
const getArg = (name) => {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim();
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1]?.trim() : undefined;
};

const uid = getArg('uid');
const email = getArg('email');

if (!uid && !email) {
  console.error('Usage: node scripts/reset-onboarding.mjs --uid <userId>');
  console.error('   or: node scripts/reset-onboarding.mjs --email <user@example.com>');
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function findUserRef() {
  if (uid) {
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    return snap.exists ? ref : null;
  }

  const snap = await db.collection('users').where('email', '==', email).limit(1).get();
  return snap.empty ? null : snap.docs[0].ref;
}

async function run() {
  const userRef = await findUserRef();
  if (!userRef) {
    throw new Error(`User not found for ${uid ? `uid ${uid}` : `email ${email}`}`);
  }

  const userSnap = await userRef.get();
  const user = userSnap.data() || {};
  const username = typeof user.username === 'string' ? user.username.trim().toLowerCase() : '';

  await userRef.update({ username: FieldValue.delete() });

  if (username) {
    const usernameRef = db.collection('usernames').doc(username);
    const usernameSnap = await usernameRef.get();
    if (usernameSnap.exists && usernameSnap.data()?.uid === userRef.id) {
      await usernameRef.delete();
    }
  }

  console.log(`Reset username onboarding for ${user.email || userRef.id}.`);
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
