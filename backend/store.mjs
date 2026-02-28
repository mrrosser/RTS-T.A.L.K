const LOBBY_TTL_MS = 2 * 60 * 60 * 1000;

const clone = (value) => structuredClone(value);

export const createLobbyStore = () => {
  const lobbies = new Map();

  const cleanupExpired = () => {
    const threshold = Date.now() - LOBBY_TTL_MS;
    for (const [code, lobby] of lobbies.entries()) {
      if (lobby.createdAt < threshold) {
        lobbies.delete(code);
      }
    }
  };

  return {
    cleanupExpired,
    hasLobby: (code) => lobbies.has(code),
    getLobbyCodes: () => {
      cleanupExpired();
      return new Set(lobbies.keys());
    },
    getLobby: (code) => {
      cleanupExpired();
      const lobby = lobbies.get(code);
      return lobby ? clone(lobby) : null;
    },
    setLobby: (lobby) => {
      cleanupExpired();
      lobbies.set(lobby.code, clone(lobby));
      return clone(lobby);
    },
    updateLobby: (code, updater) => {
      cleanupExpired();
      const lobby = lobbies.get(code);
      if (!lobby) return null;
      const nextLobby = clone(lobby);
      updater(nextLobby);
      lobbies.set(code, nextLobby);
      return clone(nextLobby);
    },
    listPublicLobbies: () => {
      cleanupExpired();
      return Array.from(lobbies.values())
        .filter((lobby) => lobby.settings.isPublic && !lobby.gameStarted)
        .map((lobby) => clone(lobby));
    },
  };
};
