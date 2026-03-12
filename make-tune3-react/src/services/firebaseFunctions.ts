import app from './firebaseApp';

let functionsPromise: Promise<import('firebase/functions').Functions> | null = null;

async function getFunctionsInstance() {
  if (!functionsPromise) {
    functionsPromise = import('firebase/functions').then(({ getFunctions }) =>
      getFunctions(app, 'europe-west1')
    );
  }

  return functionsPromise;
}

export async function callFirebaseFunction<TData = unknown, TResult = unknown>(
  name: string,
  data?: TData
): Promise<TResult> {
  const [{ httpsCallable }, functions] = await Promise.all([
    import('firebase/functions'),
    getFunctionsInstance()
  ]);
  const callable = httpsCallable<TData, TResult>(functions, name);
  const result = await callable(data as TData);
  return result.data;
}
