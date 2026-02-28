import { describe, expect, it } from 'vitest';
import { censorProfanity, containsProfanity } from '../utils/profanityFilter';

describe('profanityFilter', () => {
  it('detects profanity reliably across repeated calls', () => {
    expect(containsProfanity('This is clean text.')).toBe(false);
    expect(containsProfanity('That was bullshit.')).toBe(true);
    expect(containsProfanity('Another clean line.')).toBe(false);
    expect(containsProfanity('What the heck happened?')).toBe(true);
  });

  it('censors profane words while keeping other text', () => {
    const input = 'You are a damn brilliant debater.';
    const result = censorProfanity(input);
    expect(result).toBe('You are a **** brilliant debater.');
  });
});
