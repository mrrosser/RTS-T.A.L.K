import {
  OAuthProvider,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInAnonymously,
  signInWithPhoneNumber,
  signInWithPopup,
  updateProfile,
  type Auth,
  type ConfirmationResult,
  type User,
  getAuth,
} from 'firebase/auth';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';

export type ClientAuthSession = {
  userId: string;
  provider: string;
  displayName: string | null;
  guestId?: string | null;
  isGuest: boolean;
  getIdToken?: () => Promise<string | null>;
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

const hasFirebaseConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let phoneConfirmation: ConfirmationResult | null = null;
let recaptchaVerifier: RecaptchaVerifier | null = null;

const ensureFirebase = () => {
  if (!hasFirebaseConfig) {
    throw new Error('Firebase auth is not configured in this environment.');
  }
  if (!appInstance) {
    appInstance = getApps()[0] ?? initializeApp(firebaseConfig);
    authInstance = getAuth(appInstance);
  }
  return authInstance as Auth;
};

const toSession = async (user: User, displayNameOverride?: string | null): Promise<ClientAuthSession> => {
  return {
    userId: user.uid,
    provider: user.providerData[0]?.providerId || (user.isAnonymous ? 'guest' : 'anonymous'),
    displayName: displayNameOverride || user.displayName || null,
    guestId: user.isAnonymous ? user.uid : null,
    isGuest: user.isAnonymous,
    getIdToken: async () => user.getIdToken(),
  };
};

export const createLocalGuestSession = (displayName: string): ClientAuthSession => {
  const guestId = `guest-${crypto.randomUUID()}`;
  return {
    userId: guestId,
    provider: 'guest',
    displayName,
    guestId,
    isGuest: true,
    getIdToken: async () => null,
  };
};

export const signInAsGuest = async (displayName: string): Promise<ClientAuthSession> => {
  if (!hasFirebaseConfig) {
    return createLocalGuestSession(displayName);
  }
  const auth = ensureFirebase();
  const credential = await signInAnonymously(auth);
  if (displayName.trim()) {
    await updateProfile(credential.user, { displayName: displayName.trim() });
  }
  return toSession(credential.user, displayName);
};

export const signInWithGoogle = async (displayName: string): Promise<ClientAuthSession> => {
  const auth = ensureFirebase();
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  if (!credential.user.displayName && displayName.trim()) {
    await updateProfile(credential.user, { displayName: displayName.trim() });
  }
  return toSession(credential.user, displayName);
};

export const signInWithApple = async (displayName: string): Promise<ClientAuthSession> => {
  const auth = ensureFirebase();
  const provider = new OAuthProvider('apple.com');
  const credential = await signInWithPopup(auth, provider);
  if (!credential.user.displayName && displayName.trim()) {
    await updateProfile(credential.user, { displayName: displayName.trim() });
  }
  return toSession(credential.user, displayName);
};

export const sendPhoneCode = async (phoneNumber: string, recaptchaContainerId: string) => {
  const auth = ensureFirebase();
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      size: 'invisible',
    });
    await recaptchaVerifier.render();
  }
  phoneConfirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
};

export const confirmPhoneCode = async (code: string, displayName: string): Promise<ClientAuthSession> => {
  if (!phoneConfirmation) {
    throw new Error('Request a phone verification code first.');
  }
  const credential = await phoneConfirmation.confirm(code);
  if (!credential.user.displayName && displayName.trim()) {
    await updateProfile(credential.user, { displayName: displayName.trim() });
  }
  return toSession(credential.user, displayName);
};

export const supportsFirebaseAuth = () => hasFirebaseConfig;
