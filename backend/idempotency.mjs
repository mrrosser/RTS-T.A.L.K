const DEFAULT_TTL_MS = 60 * 60 * 1000;

export const createIdempotencyStore = (ttlMs = DEFAULT_TTL_MS) => {
  const records = new Map();

  const purgeExpired = () => {
    const now = Date.now();
    for (const [key, record] of records.entries()) {
      if (record.expiresAt <= now) {
        records.delete(key);
      }
    }
  };

  return {
    get: (key) => {
      purgeExpired();
      const record = records.get(key);
      if (!record) return null;
      return {
        status: record.status,
        body: record.body,
      };
    },
    set: (key, status, body) => {
      purgeExpired();
      records.set(key, {
        status,
        body,
        expiresAt: Date.now() + ttlMs,
      });
    },
  };
};
