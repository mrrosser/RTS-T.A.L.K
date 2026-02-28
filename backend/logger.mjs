import crypto from 'node:crypto';

export const createCorrelationId = () => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const safeStringify = (payload) => {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({ level: 'error', event: 'logger.serialize.failed' });
  }
};

export const logEvent = (level, event, context = {}) => {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...context,
  };

  // eslint-disable-next-line no-console
  console[level](safeStringify(payload));
};
