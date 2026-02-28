type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

const safeStringify = (payload: unknown): string => {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({ message: 'Failed to serialize log payload.' });
  }
};

const randomChunk = () => Math.random().toString(36).slice(2, 10);

export const createCorrelationId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${randomChunk()}`;
};

export const logEvent = (level: LogLevel, event: string, context: LogContext = {}): void => {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...context,
  };
  // eslint-disable-next-line no-console
  console[level](safeStringify(payload));
};
