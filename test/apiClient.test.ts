import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLobby, getLobbyState } from '../services/mockApi';

describe('api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls backend create lobby endpoint with idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'ABC123' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await createLobby(
      {
        topic: 'Topic',
        totalRounds: 3,
        turnDuration: 60,
        isPublic: true,
      },
      {
        id: 'host-1',
        name: 'Host',
        role: null,
        violations: { red: 0, yellow: 0, green: 0 },
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/lobbies');
    expect((options as RequestInit).method).toBe('POST');
    const headers = options?.headers as Headers;
    expect(headers.get('x-idempotency-key')).toBeTruthy();
  });

  it('returns null when lobby is missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Game not found.' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getLobbyState('MISSING');
    expect(result).toBeNull();
  });
});
