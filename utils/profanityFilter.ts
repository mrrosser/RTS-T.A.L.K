// A simple list of profane words. In a real application, this would be much more extensive
// and could be loaded from an external service or a more comprehensive library.
const profanityList: string[] = [
  'darn', 'heck', 'gosh', 'bum', 'poop',
  // Expanded list - in a real app, use a more robust solution
  'asshat', 'asshole', 'bastard', 'bitch', 'bollocks', 'bullshit', 'crap',
  'cunt', 'damn', 'frigger', 'fuck', 'goddamn', 'hell', 'horseshit',
  'motherfucker', 'piss', 'shit', 'slut', 'son of a bitch', 'twat', 'wanker'
];

const profanityRegex = new RegExp(`\\b(${profanityList.join('|')})\\b`, 'gi');

/**
 * Checks if a given string contains any profane words.
 * @param text The string to check.
 * @returns `true` if profanity is found, otherwise `false`.
 */
export const containsProfanity = (text: string): boolean => {
  return profanityRegex.test(text);
};

/**
 * Censors any profane words in a given string with asterisks.
 * @param text The string to censor.
 * @returns The censored string.
 */
export const censorProfanity = (text: string): string => {
  return text.replace(profanityRegex, (match) => '*'.repeat(match.length));
};
