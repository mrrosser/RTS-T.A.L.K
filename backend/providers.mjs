import crypto from 'node:crypto';
import { observeProvider } from '../.agents/skills/evaluation-observability/providers.mjs';
import { logEvent } from './logger.mjs';

const generateObserved = (client, payload) => observeProvider(
  () => client.models.generateContent(payload),
  { provider: 'gemini', project_id: 'rts-talk', onObservation: row => logEvent('info', 'model.usage', row) },
);

const fallbackIcebreakers = (topic) => [
  `In one sentence, what is your first instinct about ${topic}?`,
  `What is one personal experience that shapes your view on ${topic}?`,
  `What fact or principle do you think people most often miss about ${topic}?`,
];

export const createIcebreakerService = (geminiClient) => ({
  async generate(topic) {
    if (!geminiClient) {
      return fallbackIcebreakers(topic);
    }

    try {
      const response = await generateObserved(geminiClient, {
        model: 'gemini-2.5-flash',
        contents: `Generate exactly three short icebreaker questions for a debate game audience warm-up about: "${topic}". Return one question per line without numbering.`,
      });
      const questions = (response.text || '')
        .split('\n')
        .map((line) => line.replace(/^\d+[\).\s-]*/, '').trim())
        .filter(Boolean)
        .slice(0, 3);
      return questions.length === 3 ? questions : fallbackIcebreakers(topic);
    } catch {
      return fallbackIcebreakers(topic);
    }
  },
});

export const createMediaService = () => ({
  async createRoomToken({ lobbyCode, participantId, participantName, role }) {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_WS_URL || null;

    if (!apiKey || !apiSecret || !wsUrl) {
      return {
        enabled: false,
        wsUrl,
        token: null,
        roomName: `talk-${lobbyCode.toLowerCase()}`,
      };
    }

    const { AccessToken } = await import('livekit-server-sdk');
    const roomName = `talk-${lobbyCode.toLowerCase()}`;
    const token = new AccessToken(apiKey, apiSecret, {
      identity: participantId,
      name: participantName,
      metadata: JSON.stringify({ role }),
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return {
      enabled: true,
      wsUrl,
      token: await token.toJwt(),
      roomName,
    };
  },
});

const createUploadSignature = (filename) => {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  return `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
};

export const createUploadService = () => ({
  async createBackdropUpload({ lobbyCode, playerId, contentType, filename }) {
    const bucketName = process.env.GCS_UPLOAD_BUCKET;
    if (!bucketName) {
      return {
        enabled: false,
        uploadUrl: null,
        assetUrl: null,
        objectPath: null,
      };
    }

    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage();
    const objectPath = `talk-backdrops/${lobbyCode}/${playerId}/${createUploadSignature(filename)}`;
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectPath);
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType,
    });

    return {
      enabled: true,
      uploadUrl,
      assetUrl: `https://storage.googleapis.com/${bucketName}/${objectPath}`,
      objectPath,
    };
  },
});
