import { createCorrelationId, logEvent } from '../utils/logger';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export interface TranscriptAssistResult {
  suggestion: string | null;
  note: string;
}

export const verifyFact = async (statement: string): Promise<string> => {
  const correlationId = createCorrelationId();

  try {
    const response = await fetch(`${API_BASE_URL}/api/fact-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({ statement }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof payload?.error === 'string' ? payload.error : 'Fact-check request failed.';
      return message;
    }

    return typeof payload?.result === 'string' ? payload.result : 'No fact-check result returned.';
  } catch (error) {
    logEvent('error', 'factCheck.request.failed', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 'An unexpected error occurred during fact-checking.';
  }
};

export const tightenTranscript = async (transcript: string): Promise<TranscriptAssistResult> => {
  const correlationId = createCorrelationId();

  try {
    const response = await fetch(`${API_BASE_URL}/api/transcript-assist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({
        transcript,
        mode: 'tighten',
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof payload?.error === 'string' ? payload.error : 'Transcript assist request failed.';
      return {
        suggestion: null,
        note: message,
      };
    }

    return {
      suggestion: typeof payload?.transcript === 'string' ? payload.transcript : null,
      note: typeof payload?.note === 'string' ? payload.note : 'Gemini did not return a transcript suggestion.',
    };
  } catch (error) {
    logEvent('error', 'transcriptAssist.request.failed', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      suggestion: null,
      note: 'An unexpected error occurred during transcript assist.',
    };
  }
};
