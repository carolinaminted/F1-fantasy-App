// Fix: Use scoped @firebase packages for imports to resolve module errors.
import { initializeApp } from "@firebase/app";
import { getAuth } from "@firebase/auth";
import { getFirestore } from "@firebase/firestore";
import { getFunctions } from "@firebase/functions";
import { getAnalytics } from "@firebase/analytics";
import { firebaseConfig } from '../firebaseConfig.ts';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics
export const analytics = getAnalytics(app);

// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);