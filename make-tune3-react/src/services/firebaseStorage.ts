import app from './firebaseApp';

let storagePromise: Promise<import('firebase/storage').FirebaseStorage> | null = null;

export async function getFirebaseStorage() {
  if (!storagePromise) {
    storagePromise = import('firebase/storage').then(({ getStorage }) => {
      if (process.env.NODE_ENV === 'test' && globalThis.firebaseStorage) {
        return globalThis.firebaseStorage;
      }

      const storageBucketUrl = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
        ? `gs://${import.meta.env.VITE_FIREBASE_STORAGE_BUCKET}`
        : undefined;

      return storageBucketUrl ? getStorage(app, storageBucketUrl) : getStorage(app);
    });
  }

  return storagePromise;
}
