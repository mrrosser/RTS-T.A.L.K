// A simple list of profane words. In a real application, this should come from
// a maintained moderation source.
const profanityList: string[] = [
  'darn', 'heck', 'gosh', 'bum', 'poop',
  'asshat', 'asshole', 'bastard', 'bitch', 'bollocks', 'bullshit', 'crap',
  'cunt', 'damn', 'frigger', 'fuck', 'goddamn', 'hell', 'horseshit',
  'motherfucker', 'piss', 'shit', 'slut', 'son of a bitch', 'twat', 'wanker',
];

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const profanityPattern = profanityList.map(escapeRegex).join('|');

const containsRegex = new RegExp(`\\b(?:${profanityPattern})\\b`, 'i');
const censorRegex = new RegExp(`\\b(?:${profanityPattern})\\b`, 'gi');

/**
 * Checks if a given string contains any profane words.
 */
export const containsProfanity = (text: string): boolean => containsRegex.test(text);

/**
 * Censors any profane words in a given string with asterisks.
 */
export const censorProfanity = (text: string): string => text.replace(censorRegex, (match) => '*'.repeat(match.length));
