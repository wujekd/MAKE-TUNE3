// Simple runner for the Firebase setup script
import { setupFirebaseCollections } from './src/scripts/setup-firebase-collections.ts';

console.log('🚀 Starting Firebase setup...');

setupFirebaseCollections()
  .then((result) => {
    console.log('✅ Setup completed successfully!');
    console.log('📋 Results:', result);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }); 