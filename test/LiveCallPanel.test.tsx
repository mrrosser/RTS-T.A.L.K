import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LiveCallPanel from '../components/LiveCallPanel';
import type { Player } from '../types';

const { createMediaTokenMock, currentRoomRef } = vi.hoisted(() => ({
  createMediaTokenMock: vi.fn(),
  currentRoomRef: { current: null as any },
}));

vi.mock('../services/mockApi', () => ({
  createMediaToken: (...args: unknown[]) => createMediaTokenMock(...args),
}));

vi.mock('livekit-client', () => {
  class MockLocalParticipant {
    identity = 'player-1';
    name = 'Host';
    microphonePublication: { isMuted: boolean; audioTrack?: undefined } | undefined;
    cameraPublication: { isMuted: boolean; videoTrack?: undefined } | undefined;
    setMicrophoneEnabled = vi.fn(async (enabled: boolean) => {
      this.microphonePublication = enabled ? { isMuted: false } : undefined;
      return undefined;
    });
    setCameraEnabled = vi.fn(async (enabled: boolean) => {
      this.cameraPublication = enabled ? { isMuted: false } : undefined;
      return undefined;
    });
    getTrackPublication(source: string) {
      if (source === 'microphone') return this.microphonePublication;
      if (source === 'camera') return this.cameraPublication;
      return undefined;
    }
  }

  class MockRoom {
    localParticipant = new MockLocalParticipant();
    remoteParticipants = new Map();
    state = 'disconnected';
    on = vi.fn();
    off = vi.fn();
    connect = vi.fn(async () => {
      this.state = 'connected';
    });
    disconnect = vi.fn(async () => undefined);
    startAudio = vi.fn(async () => undefined);
    startVideo = vi.fn(async () => undefined);

    constructor() {
      currentRoomRef.current = this;
    }
  }

  return {
    Room: MockRoom,
    RoomEvent: {
      ConnectionStateChanged: 'connectionStateChanged',
      ParticipantConnected: 'participantConnected',
      ParticipantDisconnected: 'participantDisconnected',
      TrackSubscribed: 'trackSubscribed',
      TrackUnsubscribed: 'trackUnsubscribed',
      TrackMuted: 'trackMuted',
      TrackUnmuted: 'trackUnmuted',
      LocalTrackPublished: 'localTrackPublished',
      LocalTrackUnpublished: 'localTrackUnpublished',
      MediaDevicesError: 'mediaDevicesError',
    },
    ConnectionState: {
      Connected: 'connected',
      Connecting: 'connecting',
      Disconnected: 'disconnected',
    },
    Track: {
      Source: {
        Camera: 'camera',
        Microphone: 'microphone',
      },
    },
  };
});

const localPlayer: Player = {
  id: 'player-1',
  name: 'Host',
  role: 'Conversationalist',
  violations: { red: 0, yellow: 0, green: 0 },
};

describe('LiveCallPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentRoomRef.current = null;
  });

  it('shows the disabled state when LiveKit is not configured', async () => {
    createMediaTokenMock.mockResolvedValue({
      enabled: false,
      token: null,
      wsUrl: null,
      roomName: 'talk-demo',
    });

    render(
      <LiveCallPanel
        gameCode="ROOM1"
        localPlayer={localPlayer}
        players={[localPlayer]}
        onPresenceChange={vi.fn()}
      />,
    );

    expect(await screen.findByText(/LiveKit is not configured/i)).toBeInTheDocument();
    expect(createMediaTokenMock).toHaveBeenCalledWith({
      lobbyCode: 'ROOM1',
      participantId: 'player-1',
      participantName: 'Host',
      role: 'Conversationalist',
    });
  });

  it('connects and syncs mic state for the local player', async () => {
    const onPresenceChange = vi.fn();
    createMediaTokenMock.mockResolvedValue({
      enabled: true,
      token: 'token-123',
      wsUrl: 'wss://livekit.example.test',
      roomName: 'talk-room1',
    });

    render(
      <LiveCallPanel
        gameCode="ROOM1"
        localPlayer={localPlayer}
        players={[localPlayer]}
        onPresenceChange={onPresenceChange}
      />,
    );

    await screen.findByText('talk-room1 · connected');
    await waitFor(() => {
      expect(currentRoomRef.current?.connect).toHaveBeenCalledWith('wss://livekit.example.test', 'token-123');
    });

    const micButton = await screen.findByRole('button', { name: 'Turn Mic On' });
    expect(micButton).toBeEnabled();
    fireEvent.click(micButton);

    await waitFor(() => {
      expect(currentRoomRef.current?.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    });

    expect(onPresenceChange).toHaveBeenCalledWith({
      playerId: 'player-1',
      micLive: true,
      videoEnabled: false,
    });
  });

  it('does not reconnect or clear presence on unrelated parent rerenders', async () => {
    createMediaTokenMock.mockResolvedValue({
      enabled: true,
      token: 'token-123',
      wsUrl: 'wss://livekit.example.test',
      roomName: 'talk-room1',
    });

    const { rerender } = render(
      <LiveCallPanel
        gameCode="ROOM1"
        localPlayer={localPlayer}
        players={[localPlayer]}
        onPresenceChange={vi.fn()}
      />,
    );

    await screen.findByText('talk-room1 · connected');
    const connectedRoom = currentRoomRef.current;

    rerender(
      <LiveCallPanel
        gameCode="ROOM1"
        localPlayer={localPlayer}
        players={[localPlayer]}
        onPresenceChange={vi.fn()}
      />,
    );

    expect(createMediaTokenMock).toHaveBeenCalledTimes(1);
    expect(connectedRoom.disconnect).not.toHaveBeenCalled();
    expect(currentRoomRef.current).toBe(connectedRoom);
  });

  it('disables local mic controls when the referee has muted the player', async () => {
    createMediaTokenMock.mockResolvedValue({
      enabled: true,
      token: 'token-123',
      wsUrl: 'wss://livekit.example.test',
      roomName: 'talk-room1',
    });

    const mutedPlayer: Player = {
      ...localPlayer,
      presence: {
        micLive: false,
        videoEnabled: false,
        activeSpeaker: true,
        mutedByReferee: true,
        mutedByActionId: 'ref-action-1',
      },
    };

    render(
      <LiveCallPanel
        gameCode="ROOM1"
        localPlayer={mutedPlayer}
        players={[mutedPlayer]}
        onPresenceChange={vi.fn()}
      />,
    );

    await screen.findByText('talk-room1 · connected');
    expect(await screen.findByText(/referee has muted your live mic/i)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Turn Mic On' })).toBeDisabled();
  });
});
