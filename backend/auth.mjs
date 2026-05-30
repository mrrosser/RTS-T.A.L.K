import { createCorrelationId, logEvent } from './logger.mjs';

const OPTIONAL_PROVIDER_HEADERS = {
  userId: 'x-auth-user-id',
  provider: 'x-auth-provider',
  guestId: 'x-guest-id',
  displayName: 'x-auth-display-name',
};

const getBearerToken = (req) => {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
};

const GUEST_PROVIDERS = new Set(['guest', 'anonymous']);

const createFallbackAuthContext = (req, options = {}) => {
  const explicitUserId = req.get(OPTIONAL_PROVIDER_HEADERS.userId);
  const explicitProvider = req.get(OPTIONAL_PROVIDER_HEADERS.provider);
  const guestId = req.get(OPTIONAL_PROVIDER_HEADERS.guestId);
  const provider = explicitProvider || (guestId ? 'guest' : 'guest');
  if (options.strict && explicitProvider && !GUEST_PROVIDERS.has(explicitProvider)) {
    throw new Error('Verified Firebase token is required for non-guest authentication.');
  }
  const userId = explicitUserId || guestId || `guest-${createCorrelationId()}`;
  return {
    userId,
    authProvider: provider,
    isGuest: provider === 'guest',
    tokenVerified: false,
    displayName: req.get(OPTIONAL_PROVIDER_HEADERS.displayName) || null,
  };
};

const createFirebaseVerifier = async () => {
  const { initializeApp, cert, getApps, applicationDefault } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');

  if (getApps().length === 0) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.FIREBASE_PROJECT_ID;

    if (privateKey && clientEmail && projectId) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } else {
      initializeApp({
        credential: applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    }
  }

  const auth = getAuth();
  return async (token) => auth.verifyIdToken(token);
};

export const createAuthResolver = async (options = {}) => {
  const strict = options.strict ?? process.env.FIREBASE_AUTH_STRICT === 'true';
  let verifyIdToken = null;

  if (options.verifyIdToken) {
    verifyIdToken = options.verifyIdToken;
  } else if (process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      verifyIdToken = await createFirebaseVerifier();
    } catch (error) {
      logEvent('warn', 'auth.firebase.init_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      if (strict) throw error;
    }
  }

  return async (req) => {
    const bearerToken = getBearerToken(req);
    if (!bearerToken) {
      return createFallbackAuthContext(req, { strict });
    }

    if (!verifyIdToken) {
      if (strict) {
        throw new Error('Firebase token verification is required but not configured.');
      }
      return {
        ...createFallbackAuthContext(req, { strict }),
        tokenPresent: true,
      };
    }

    const decoded = await verifyIdToken(bearerToken);
    return {
      userId: decoded.uid,
      authProvider: decoded.firebase?.sign_in_provider || 'custom',
      isGuest: decoded.firebase?.sign_in_provider === 'anonymous',
      tokenVerified: true,
      displayName: decoded.name || decoded.email || req.get(OPTIONAL_PROVIDER_HEADERS.displayName) || null,
      phoneNumber: decoded.phone_number || null,
    };
  };
};
