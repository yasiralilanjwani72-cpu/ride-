import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

// Validation Synchronicity Constants from firebase-blueprint.json
export const VALIDATION_LIMITS = {
  ID_MAX: 128,
  ID_REGEX: /^[a-zA-Z0-9_\-]+$/,
  NAME_MAX: 100,
  EMAIL_MAX: 150,
  PHONE_MAX: 30,
  CITY_MAX: 80,
  BIO_PASSENGER_MAX: 500,
  BIO_DRIVER_MAX: 600,
  LICENSE_SUMMARY_MAX: 120,
  LOCATION_MAX: 200,
  STOPS_MAX: 300,
  RIDE_DESC_MAX: 600,
  REVIEW_COMMENT_MAX: 500,
  NOTIF_TITLE_MAX: 120,
  NOTIF_MSG_MAX: 400,
  URL_MAX: 1000,
};

export function sanitizeString(val: string | undefined | null, maxLen: number): string {
  if (!val) return '';
  return String(val).trim().slice(0, maxLen);
}

export function generateSafeId(prefix = 'id'): string {
  const rand = Math.random().toString(36).substring(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64);
}
