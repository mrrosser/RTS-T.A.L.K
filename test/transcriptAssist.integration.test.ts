// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../backend/app.mjs';

describe('transcript assist api', () => {
  it('returns a cleaned transcript suggestion from the configured Gemini client', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        transcript: 'This is my direct answer.',
        note: 'Removed filler and duplicate phrasing.',
      }),
    });

    const app = createApp({
      serveStatic: false,
      geminiClient: {
        models: {
          generateContent,
        },
      },
    });

    const response = await request(app)
      .post('/api/transcript-assist')
      .send({
        transcript: 'Um this is, this is my direct answer.',
        mode: 'tighten',
      })
      .expect(200);

    expect(response.body).toEqual({
      transcript: 'This is my direct answer.',
      note: 'Removed filler and duplicate phrasing.',
    });
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-2.5-flash',
    }));
  });
});
