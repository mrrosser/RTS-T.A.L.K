import { EventEmitter } from 'node:events';

const LOBBY_TTL_MS = 2 * 60 * 60 * 1000;
const IDEMPOTENCY_TTL_MS = 60 * 60 * 1000;
const PROFILE_SESSION_LIMIT = 25;

const clone = (value) => structuredClone(value);

const purgeExpiredEntries = (map) => {
  const now = Date.now();
  for (const [key, value] of map.entries()) {
    if (value.expiresAt <= now) {
      map.delete(key);
    }
  }
};

const createMemoryRepository = () => {
  const lobbies = new Map();
  const idempotency = new Map();
  const profiles = new Map();
  const sessions = new Map();
  const emitter = new EventEmitter();

  const cleanupExpiredLobbies = () => {
    const threshold = Date.now() - LOBBY_TTL_MS;
    for (const [code, lobby] of lobbies.entries()) {
      if ((lobby.updatedAt ?? lobby.createdAt) < threshold) {
        lobbies.delete(code);
      }
    }
  };

  const publishLobby = (lobby) => {
    emitter.emit(`lobby:${lobby.code}`, clone(lobby));
  };

  return {
    kind: 'memory',
    async getLobbyCodes() {
      cleanupExpiredLobbies();
      return new Set(lobbies.keys());
    },
    async getLobby(code) {
      cleanupExpiredLobbies();
      const lobby = lobbies.get(code);
      return lobby ? clone(lobby) : null;
    },
    async setLobby(lobby) {
      cleanupExpiredLobbies();
      const nextLobby = { ...clone(lobby), updatedAt: Date.now() };
      lobbies.set(nextLobby.code, nextLobby);
      publishLobby(nextLobby);
      return clone(nextLobby);
    },
    async updateLobby(code, updater) {
      cleanupExpiredLobbies();
      const current = lobbies.get(code);
      if (!current) return null;
      const nextLobby = clone(current);
      updater(nextLobby);
      nextLobby.updatedAt = Date.now();
      lobbies.set(code, nextLobby);
      publishLobby(nextLobby);
      return clone(nextLobby);
    },
    async listPublicLobbies() {
      cleanupExpiredLobbies();
      return Array.from(lobbies.values())
        .filter((lobby) => lobby.settings.isPublic && !lobby.gameStarted)
        .map((lobby) => clone(lobby));
    },
    async getIdempotencyRecord(key) {
      purgeExpiredEntries(idempotency);
      const record = idempotency.get(key);
      if (!record) return null;
      return { status: record.status, body: clone(record.body) };
    },
    async setIdempotencyRecord(key, status, body, ttlMs = IDEMPOTENCY_TTL_MS) {
      purgeExpiredEntries(idempotency);
      idempotency.set(key, {
        status,
        body: clone(body),
        expiresAt: Date.now() + ttlMs,
      });
    },
    async getUserProfile(userId) {
      const profile = profiles.get(userId);
      return profile ? clone(profile) : null;
    },
    async upsertUserProfile(userId, updater) {
      const current =
        profiles.get(userId) ??
        {
          userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          displayName: '',
          authProvider: 'guest',
          rememberedTrustedSources: [],
          preferredBackdrop: null,
          approvedPhrases: [],
          lastLobbyCode: null,
          lastRole: null,
        };
      const nextProfile = clone(current);
      updater(nextProfile);
      nextProfile.updatedAt = Date.now();
      profiles.set(userId, nextProfile);
      return clone(nextProfile);
    },
    async listUserSessions(userId) {
      return clone((sessions.get(userId) ?? []).slice(-PROFILE_SESSION_LIMIT).reverse());
    },
    async saveSessionSummary(userId, summary) {
      const current = sessions.get(userId) ?? [];
      const next = [...current, clone(summary)].slice(-PROFILE_SESSION_LIMIT);
      sessions.set(userId, next);
      return clone(summary);
    },
    subscribeToLobby(code, listener) {
      const eventName = `lobby:${code}`;
      emitter.on(eventName, listener);
      return () => emitter.off(eventName, listener);
    },
  };
};

const ensureFirestoreDependency = async () => {
  const { Firestore, FieldValue } = await import('@google-cloud/firestore');
  return { Firestore, FieldValue };
};

const createFirestoreRepository = async () => {
  const { Firestore } = await ensureFirestoreDependency();
  const firestore = new Firestore();
  const lobbies = firestore.collection('talk_lobbies');
  const idempotency = firestore.collection('talk_idempotency');
  const profiles = firestore.collection('talk_profiles');
  const sessions = firestore.collection('talk_sessions');

  return {
    kind: 'firestore',
    async getLobbyCodes() {
      const snapshot = await lobbies.select().get();
      return new Set(snapshot.docs.map((doc) => doc.id));
    },
    async getLobby(code) {
      const doc = await lobbies.doc(code).get();
      if (!doc.exists) return null;
      return clone(doc.data());
    },
    async setLobby(lobby) {
      const nextLobby = { ...clone(lobby), updatedAt: Date.now() };
      await lobbies.doc(nextLobby.code).set(nextLobby);
      return clone(nextLobby);
    },
    async updateLobby(code, updater) {
      return firestore.runTransaction(async (transaction) => {
        const ref = lobbies.doc(code);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) return null;
        const nextLobby = clone(snapshot.data());
        updater(nextLobby);
        nextLobby.updatedAt = Date.now();
        transaction.set(ref, nextLobby);
        return clone(nextLobby);
      });
    },
    async listPublicLobbies() {
      const snapshot = await lobbies
        .where('settings.isPublic', '==', true)
        .where('gameStarted', '==', false)
        .get();
      return snapshot.docs.map((doc) => clone(doc.data()));
    },
    async getIdempotencyRecord(key) {
      const doc = await idempotency.doc(key).get();
      if (!doc.exists) return null;
      const record = doc.data();
      if (record.expiresAt <= Date.now()) {
        await idempotency.doc(key).delete();
        return null;
      }
      return { status: record.status, body: clone(record.body) };
    },
    async setIdempotencyRecord(key, status, body, ttlMs = IDEMPOTENCY_TTL_MS) {
      await idempotency.doc(key).set({
        status,
        body: clone(body),
        expiresAt: Date.now() + ttlMs,
        updatedAt: Date.now(),
      });
    },
    async getUserProfile(userId) {
      const doc = await profiles.doc(userId).get();
      return doc.exists ? clone(doc.data()) : null;
    },
    async upsertUserProfile(userId, updater) {
      const ref = profiles.doc(userId);
      return firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const nextProfile =
          snapshot.exists
            ? clone(snapshot.data())
            : {
                userId,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                displayName: '',
                authProvider: 'guest',
                rememberedTrustedSources: [],
                preferredBackdrop: null,
                approvedPhrases: [],
                lastLobbyCode: null,
                lastRole: null,
              };
        updater(nextProfile);
        nextProfile.updatedAt = Date.now();
        transaction.set(ref, nextProfile);
        return clone(nextProfile);
      });
    },
    async listUserSessions(userId) {
      const snapshot = await sessions
        .where('userId', '==', userId)
        .orderBy('endedAt', 'desc')
        .limit(PROFILE_SESSION_LIMIT)
        .get();
      return snapshot.docs.map((doc) => clone(doc.data()));
    },
    async saveSessionSummary(userId, summary) {
      const nextSummary = clone(summary);
      await sessions.doc(nextSummary.sessionId).set({
        ...nextSummary,
        userId,
      });
      return nextSummary;
    },
    subscribeToLobby(code, listener) {
      const unsubscribe = lobbies.doc(code).onSnapshot((snapshot) => {
        if (snapshot.exists) {
          listener(clone(snapshot.data()));
        }
      });
      return () => unsubscribe();
    },
  };
};

export const createTalkRepository = async (options = {}) => {
  const backend = options.backend ?? process.env.TALK_STORAGE_BACKEND ?? 'memory';
  if (backend === 'firestore') {
    return createFirestoreRepository();
  }
  return createMemoryRepository();
};
