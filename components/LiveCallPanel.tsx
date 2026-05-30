import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { LocalParticipant, RemoteParticipant } from 'livekit-client';
import { createMediaToken } from '../services/mockApi';
import type { Player } from '../types';
import { logEvent } from '../utils/logger';

interface LiveCallPanelProps {
  gameCode: string;
  localPlayer: Player;
  players: Player[];
  onPresenceChange: (payload: { playerId: string; micLive: boolean; videoEnabled?: boolean }) => Promise<void> | void;
}

type LiveParticipant = LocalParticipant | RemoteParticipant;
type ConnectionStateValue = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'signalReconnecting';
type LiveKitRuntime = typeof import('livekit-client');
type AttachableTrack = {
  attach: (element: HTMLMediaElement) => HTMLMediaElement;
  detach: (element: HTMLMediaElement) => HTMLMediaElement;
};

type MediaTokenState =
  | { status: 'loading'; message: string }
  | { status: 'disabled'; message: string }
  | { status: 'ready'; wsUrl: string; token: string; roomName: string }
  | { status: 'error'; message: string };

const MediaAttachment: React.FC<{
  track?: AttachableTrack | undefined;
  kind: 'audio' | 'video';
  muted?: boolean;
}> = ({ track, kind, muted = false }) => {
  const ref = useRef<HTMLMediaElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!track || !element) return undefined;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);

  if (kind === 'audio') {
    return <audio ref={ref as React.RefObject<HTMLAudioElement>} autoPlay playsInline muted={muted} className="hidden" />;
  }

  return <video ref={ref as React.RefObject<HTMLVideoElement>} autoPlay playsInline muted={muted} className="h-full w-full object-cover" />;
};

const getVideoTrack = (participant: LiveParticipant) =>
  participant.getTrackPublication('camera' as any)?.videoTrack;

const getAudioTrack = (participant: LiveParticipant) =>
  participant.getTrackPublication('microphone' as any)?.audioTrack;

const getMicEnabled = (participant: LiveParticipant) => {
  const publication = participant.getTrackPublication('microphone' as any);
  return Boolean(publication && !publication.isMuted);
};

const getCameraEnabled = (participant: LiveParticipant) => {
  const publication = participant.getTrackPublication('camera' as any);
  return Boolean(publication && !publication.isMuted);
};

const parseConnectionError = (error: unknown) =>
  error instanceof Error ? error.message : 'Unable to connect to the live call.';

const LiveCallPanel: React.FC<LiveCallPanelProps> = ({
  gameCode,
  localPlayer,
  players,
  onPresenceChange,
}) => {
  const roomRef = useRef<InstanceType<LiveKitRuntime['Room']> | null>(null);
  const onPresenceChangeRef = useRef(onPresenceChange);
  const [tokenState, setTokenState] = useState<MediaTokenState>({
    status: 'loading',
    message: 'Preparing live call...',
  });
  const [roomState, setRoomState] = useState<ConnectionStateValue>('disconnected');
  const [roomVersion, setRoomVersion] = useState(0);
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [needsAudioGesture, setNeedsAudioGesture] = useState(false);
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const localPlayerState = playerById.get(localPlayer.id) ?? localPlayer;
  const mutedByReferee = Boolean(localPlayerState.presence?.mutedByReferee);
  const canViewAllVideo = localPlayer.role === 'Referee' || localPlayer.role === 'Time Keeper';
  const mediaControlsReady =
    roomRef.current !== null &&
    (roomState === 'connected' || roomState === 'reconnecting' || roomState === 'signalReconnecting');

  useEffect(() => {
    onPresenceChangeRef.current = onPresenceChange;
  }, [onPresenceChange]);

  useEffect(() => {
    let cancelled = false;

    const loadToken = async () => {
      setTokenState({
        status: 'loading',
        message: 'Preparing live call...',
      });

      try {
        const response = await createMediaToken({
          lobbyCode: gameCode,
          participantId: localPlayer.id,
          participantName: localPlayer.name,
          role: localPlayer.role!,
        });

        if (cancelled) return;

        if (!response.enabled || !response.token || !response.wsUrl) {
          setTokenState({
            status: 'disabled',
            message: 'Live call is not configured for this environment yet.',
          });
          return;
        }

        setTokenState({
          status: 'ready',
          wsUrl: response.wsUrl,
          token: response.token,
          roomName: response.roomName,
        });
      } catch (error) {
        if (cancelled) return;
        setTokenState({
          status: 'error',
          message: parseConnectionError(error),
        });
      }
    };

    void loadToken();

    return () => {
      cancelled = true;
    };
  }, [gameCode, localPlayer.id, localPlayer.name, localPlayer.role]);

  useEffect(() => {
    if (tokenState.status !== 'ready') {
      return undefined;
    }

    let disposed = false;
    const connect = async () => {
      try {
        const liveKit = await import('livekit-client');
        if (disposed) return;

        const room = new liveKit.Room({
          adaptiveStream: true,
          dynacast: true,
        });
        roomRef.current = room;

        const refreshRoom = () => {
          if (disposed) return;
          setRoomState(room.state as ConnectionStateValue);
          setMicEnabled(getMicEnabled(room.localParticipant));
          setCameraEnabled(getCameraEnabled(room.localParticipant));
          setRoomVersion((value) => value + 1);
        };

        const reportDeviceError = (error: Error) => {
          logEvent('error', 'liveCall.mediaDevices.error', {
            code: gameCode,
            playerId: localPlayer.id,
            error: error.message,
          });
        };

        room.on(liveKit.RoomEvent.ConnectionStateChanged, refreshRoom);
        room.on(liveKit.RoomEvent.ParticipantConnected, refreshRoom);
        room.on(liveKit.RoomEvent.ParticipantDisconnected, refreshRoom);
        room.on(liveKit.RoomEvent.TrackSubscribed, refreshRoom);
        room.on(liveKit.RoomEvent.TrackUnsubscribed, refreshRoom);
        room.on(liveKit.RoomEvent.TrackMuted, refreshRoom);
        room.on(liveKit.RoomEvent.TrackUnmuted, refreshRoom);
        room.on(liveKit.RoomEvent.LocalTrackPublished, refreshRoom);
        room.on(liveKit.RoomEvent.LocalTrackUnpublished, refreshRoom);
        room.on(liveKit.RoomEvent.MediaDevicesError, reportDeviceError);

        await room.connect(tokenState.wsUrl, tokenState.token);
        refreshRoom();
        try {
          await room.startAudio();
          setNeedsAudioGesture(false);
        } catch {
          setNeedsAudioGesture(true);
        }
      } catch (error) {
        if (disposed) return;
        setTokenState({
          status: 'error',
          message: parseConnectionError(error),
        });
      }
    };

    void connect();

    return () => {
      disposed = true;
      roomRef.current?.disconnect(true).catch(() => undefined);
      roomRef.current = null;
      setRoomState('disconnected');
      setMicEnabled(false);
      setCameraEnabled(false);
      void onPresenceChangeRef.current({
        playerId: localPlayer.id,
        micLive: false,
        videoEnabled: false,
      });
    };
  }, [gameCode, localPlayer.id, tokenState]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || !mutedByReferee || !micEnabled) return;
    void room.localParticipant.setMicrophoneEnabled(false).catch(() => undefined);
    setMicEnabled(false);
  }, [micEnabled, mutedByReferee]);

  const connectedParticipants = useMemo(() => {
    const room = roomRef.current;
    if (!room) return [];
    const remoteParticipants = Array.from(room.remoteParticipants.values() as Iterable<RemoteParticipant>);
    return [
      {
        identity: localPlayer.id,
        participant: room.localParticipant as LiveParticipant,
        isLocal: true,
      },
      ...remoteParticipants.map((participant) => ({
        identity: participant.identity,
        participant: participant as RemoteParticipant,
        isLocal: false,
      })),
    ];
  }, [localPlayer.id, roomVersion]);

  const handleEnablePlayback = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
      setNeedsAudioGesture(false);
    } catch (error) {
      logEvent('warn', 'liveCall.audioPlayback.blocked', {
        code: gameCode,
        playerId: localPlayer.id,
        error: parseConnectionError(error),
      });
    }
  };

  const handleToggleMicrophone = async () => {
    const room = roomRef.current;
    if (!room || mutedByReferee) return;
    const nextValue = !micEnabled;

    try {
      if (nextValue) {
        await room.startAudio().catch(() => {
          setNeedsAudioGesture(true);
        });
      }
      await room.localParticipant.setMicrophoneEnabled(nextValue);
      setMicEnabled(nextValue);
      await onPresenceChangeRef.current({
        playerId: localPlayer.id,
        micLive: nextValue,
        videoEnabled: cameraEnabled,
      });
      setRoomVersion((value) => value + 1);
    } catch (error) {
      logEvent('error', 'liveCall.microphone.toggle.failed', {
        code: gameCode,
        playerId: localPlayer.id,
        error: parseConnectionError(error),
      });
    }
  };

  const handleToggleCamera = async () => {
    const room = roomRef.current;
    if (!room) return;
    const nextValue = !cameraEnabled;

    try {
      if (nextValue) {
        await room.startVideo().catch(() => undefined);
      }
      await room.localParticipant.setCameraEnabled(nextValue);
      setCameraEnabled(nextValue);
      await onPresenceChangeRef.current({
        playerId: localPlayer.id,
        micLive: micEnabled,
        videoEnabled: nextValue,
      });
      setRoomVersion((value) => value + 1);
    } catch (error) {
      logEvent('error', 'liveCall.camera.toggle.failed', {
        code: gameCode,
        playerId: localPlayer.id,
        error: parseConnectionError(error),
      });
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4 backdrop-blur-lg">
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-white/10 pb-3">
        <div>
          <h2 className="font-display text-3xl font-bold text-gray-100">Live Call</h2>
          <p className="text-sm text-gray-400">
            {tokenState.status === 'ready'
              ? `${tokenState.roomName} · ${roomState}`
              : tokenState.message}
          </p>
        </div>
        {tokenState.status === 'ready' && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleToggleMicrophone}
              disabled={!mediaControlsReady || mutedByReferee}
              className={`rounded px-3 py-2 text-sm font-bold ${micEnabled ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-100'} ${mediaControlsReady && !mutedByReferee ? '' : 'cursor-not-allowed opacity-60'}`}
            >
              {micEnabled ? 'Mute Mic' : 'Turn Mic On'}
            </button>
            <button
              type="button"
              onClick={handleToggleCamera}
              disabled={!mediaControlsReady}
              className={`rounded px-3 py-2 text-sm font-bold ${cameraEnabled ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-100'} ${mediaControlsReady ? '' : 'cursor-not-allowed opacity-60'}`}
            >
              {cameraEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
            </button>
          </div>
        )}
      </div>

      {needsAudioGesture && tokenState.status === 'ready' && (
        <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-950/40 p-3 text-sm text-amber-100">
          Browser audio playback is waiting on a user gesture.
          <button type="button" onClick={handleEnablePlayback} className="ml-3 rounded bg-amber-600 px-3 py-1 font-semibold text-black">
            Enable Audio
          </button>
        </div>
      )}

      {mutedByReferee && tokenState.status === 'ready' && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-100">
          The referee has muted your live mic. Audience review can overturn that action if needed.
        </div>
      )}

      {tokenState.status === 'disabled' && (
        <div className="rounded-lg border border-dashed border-white/10 bg-black/20 p-6 text-sm text-gray-400">
          LiveKit is not configured. The game will keep using the existing non-live fallback behavior.
        </div>
      )}

      {tokenState.status === 'error' && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-100">
          {tokenState.message}
        </div>
      )}

      {tokenState.status === 'loading' && (
        <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-sm text-gray-400">
          {tokenState.message}
        </div>
      )}

      {tokenState.status === 'ready' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {connectedParticipants.map(({ identity, participant, isLocal }) => {
            const player = playerById.get(identity);
            const videoTrack = getVideoTrack(participant);
            const audioTrack = isLocal ? undefined : getAudioTrack(participant);
            const participantMicEnabled = isLocal ? micEnabled : getMicEnabled(participant);
            const participantCameraEnabled = isLocal ? cameraEnabled : getCameraEnabled(participant);
            const shouldRenderVideo = isLocal || canViewAllVideo;
            const remoteVideoRestricted = !shouldRenderVideo && participantCameraEnabled;
            const displayedVideoTrack = shouldRenderVideo ? videoTrack : undefined;

            return (
              <div key={identity} className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/70">
                <div className="relative aspect-video bg-slate-900">
                  {displayedVideoTrack ? (
                    <MediaAttachment track={displayedVideoTrack} kind="video" muted={isLocal} />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-center text-sm text-slate-300">
                      {remoteVideoRestricted ? 'Visible to moderators only' : 'Camera off'}
                    </div>
                  )}
                  {audioTrack && <MediaAttachment track={audioTrack} kind="audio" />}
                  <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                    {participantCameraEnabled ? 'Video On' : 'Video Off'}
                  </div>
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-white">
                      {player?.name || participant.name || identity}
                      {isLocal ? ' (You)' : ''}
                    </p>
                    <p className="text-slate-400">{player?.role || 'Participant'}</p>
                  </div>
                  <div className="text-right text-xs text-slate-300">
                    <p>{participantMicEnabled ? 'Mic live' : 'Mic muted'}</p>
                    <p>{participantCameraEnabled ? 'Camera live' : 'Camera hidden'}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LiveCallPanel;
