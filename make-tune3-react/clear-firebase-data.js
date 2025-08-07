// Firebase data clearing script
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocs, deleteDoc, collection, query, where } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Read environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '.env.local');

let firebaseConfig = {};
try {
  const envContent = readFileSync(envPath, 'utf8');
  const envVars = envContent.split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) {
      acc[key.trim()] = value.trim();
    }
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
  console.error('Error reading .env.local file:', error);
  console.log('Please ensure .env.local exists with Firebase config');
  process.exit(1);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Clear all data function
async function clearFirebaseData() {
  console.log('🗑️ Starting Firebase data clearing...');

  try {
    // Clear collections in order (respecting dependencies)
    // Note: User authentication is managed by Firebase Auth, not our users collection
    const collections = [
      'submissionUsers', // Private collection
      'userCollaborations', // User interaction data
      'tracks', // Track data
      'collaborations', // Collaboration data
      'projects', // Project data
      'users' // User profiles (managed by Firebase Auth)
    ];

    for (const collectionName of collections) {
      console.log(`🗑️ Clearing ${collectionName}...`);
      
      const querySnapshot = await getDocs(collection(db, collectionName));
      const deletePromises = querySnapshot.docs.map(doc => 
        deleteDoc(doc.ref)
      );
      
      await Promise.all(deletePromises);
      console.log(`✅ Cleared ${querySnapshot.size} documents from ${collectionName}`);
    }

    console.log('🎉 Firebase data clearing complete!');
    console.log('📋 All collections have been cleared:');
    collections.forEach(collection => {
      console.log(`   - ${collection}`);
    });
    console.log('📋 Note: Firebase Authentication users are preserved');

  } catch (error) {
    console.error('❌ Error clearing Firebase data:', error);
    throw error;
  }
}

// Run the clearing
console.log('⚠️  WARNING: This will delete ALL data from Firebase!');
console.log('⚠️  User authentication is managed by Firebase Auth and will be preserved.');
console.log('⚠️  This action cannot be undone!');
console.log('');
console.log('To proceed, run: node clear-firebase-data.js --confirm');
console.log('');

// Check for confirmation flag
if (process.argv.includes('--confirm')) {
  clearFirebaseData()
    .then(() => {
      console.log('✅ Data clearing completed successfully!');
    })
    .catch((error) => {
      console.error('❌ Data clearing failed:', error);
      process.exit(1);
    });
} else {
  console.log('❌ Data clearing aborted. Use --confirm flag to proceed.');
  process.exit(0);
} 