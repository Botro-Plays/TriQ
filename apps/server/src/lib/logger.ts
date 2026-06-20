/**
 * Minimal logger — silenced in production for hosts that don't support console.
 * Set DEBUG=triq in env to re-enable.
 */
const isDev = process.env.NODE_ENV !== 'production';
const debugEnabled = process.env.DEBUG?.includes('triq');

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev || debugEnabled) console.log(...args);
  },
  error: (...args: unknown[]) => {
    if (isDev || debugEnabled) console.error(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev || debugEnabled) console.warn(...args);
  },
};
