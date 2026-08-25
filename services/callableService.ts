import {
  httpsCallable,
  httpsCallableFromURL,
  type HttpsCallable,
} from '@firebase/functions';
import { functions } from './firebase.ts';

const portalFunctionsBaseUrl = import.meta.env.VITE_PORTAL_FUNCTIONS_BASE_URL?.trim();

const callableUrl = (name: string): string | null => {
  if (!portalFunctionsBaseUrl) return null;

  const baseUrl = new URL(portalFunctionsBaseUrl);
  if (baseUrl.protocol !== 'https:') {
    throw new Error('VITE_PORTAL_FUNCTIONS_BASE_URL must use HTTPS.');
  }

  return `${baseUrl.toString().replace(/\/$/, '')}/${encodeURIComponent(name)}`;
};

/**
 * Uses the Firebase project's named callable by default. A portal build can
 * opt into the same callable contract in another Google Cloud project by
 * supplying the stable Cloud Functions base URL.
 */
export const getCallable = <RequestData = unknown, ResponseData = unknown>(
  name: string,
): HttpsCallable<RequestData, ResponseData> => {
  const url = callableUrl(name);
  return url
    ? httpsCallableFromURL<RequestData, ResponseData>(functions, url)
    : httpsCallable<RequestData, ResponseData>(functions, name);
};

