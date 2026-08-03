// Debug utilities for SimplyChat
// Only logs in development mode
const DEBUG = false;

function debugLog(...args) {
    if (DEBUG) {
        console.log('[SimplyChat Debug]', ...args);
    }
}

function debugError(...args) {
    if (DEBUG) {
        console.error('[SimplyChat Error]', ...args);
    }
}
