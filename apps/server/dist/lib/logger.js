"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
/**
 * Minimal logger — silenced in production for hosts that don't support console.
 * Set DEBUG=triq in env to re-enable.
 */
const isDev = process.env.NODE_ENV !== 'production';
const debugEnabled = process.env.DEBUG?.includes('triq');
exports.logger = {
    log: (...args) => {
        if (isDev || debugEnabled)
            console.log(...args);
    },
    error: (...args) => {
        if (isDev || debugEnabled)
            console.error(...args);
    },
    warn: (...args) => {
        if (isDev || debugEnabled)
            console.warn(...args);
    },
};
//# sourceMappingURL=logger.js.map