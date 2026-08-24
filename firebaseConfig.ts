
const requireEnv = (name: string, value: string | undefined): string => {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    throw new Error(`Missing required Firebase environment variable: ${name}`);
  }
  return normalizedValue;
};

const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim();

export const firebaseConfig = {
  apiKey: requireEnv('VITE_FIREBASE_API_KEY', import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID', import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET', import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: requireEnv('VITE_FIREBASE_APP_ID', import.meta.env.VITE_FIREBASE_APP_ID),
  ...(measurementId ? { measurementId } : {}),
};
