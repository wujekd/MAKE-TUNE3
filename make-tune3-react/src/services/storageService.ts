let storageDepsPromise: Promise<{
  storage: import('firebase/storage').FirebaseStorage;
  ref: typeof import('firebase/storage').ref;
  getBlob: typeof import('firebase/storage').getBlob;
  getDownloadURL: typeof import('firebase/storage').getDownloadURL;
  uploadBytesResumable: typeof import('firebase/storage').uploadBytesResumable;
}> | null = null;

async function getStorageDeps() {
  if (!storageDepsPromise) {
    storageDepsPromise = Promise.all([
      import('./firebaseStorage'),
      import('firebase/storage')
    ]).then(async ([firebaseStorage, storageSdk]) => ({
      storage: await firebaseStorage.getFirebaseStorage(),
      ref: storageSdk.ref,
      getBlob: storageSdk.getBlob,
      getDownloadURL: storageSdk.getDownloadURL,
      uploadBytesResumable: storageSdk.uploadBytesResumable
    }));
  }

  return storageDepsPromise;
}

export async function getStorageBlob(path: string): Promise<Blob> {
  const { storage, ref, getBlob } = await getStorageDeps();
  return getBlob(ref(storage, path));
}

export async function resolveStorageDownloadUrl(path: string): Promise<string> {
  const { storage, ref, getDownloadURL } = await getStorageDeps();
  return getDownloadURL(ref(storage, path));
}

export async function uploadFileToStorage({
  path,
  file,
  contentType,
  metadata,
  onProgress
}: {
  path: string;
  file: File;
  contentType: string;
  metadata?: Record<string, string>;
  onProgress?: (percent: number) => void;
}): Promise<void> {
  const { storage, ref, uploadBytesResumable } = await getStorageDeps();
  const task = uploadBytesResumable(ref(storage, path), file, {
    contentType,
    customMetadata: metadata
  });

  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      snap => {
        if (!onProgress) return;
        const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
        onProgress(Math.round(pct));
      },
      err => reject(err),
      () => resolve()
    );
  });
}
