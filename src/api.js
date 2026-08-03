/*
 * Basefill integration surface
 *
 * This file is intentionally small and dependency-free. Forks can configure
 * an API URL or replace any hook below without changing the user-facing UI.
 * Keep secrets out of this renderer; use a secure session or a preload bridge
 * for sensitive credentials in production deployments.
 */

window.BASEFILL_CONFIG = Object.assign({
    apiBaseUrl: '',
    appName: 'Basefill',
    authMode: 'guest'
}, window.BASEFILL_CONFIG || {});

const BasefillAPI = {
    config: window.BASEFILL_CONFIG,

    // Replace these hooks in a fork. Returning null from loadWorkspace keeps
    // the local demo workspace as the safe default for a new installation.
    hooks: {
        loadWorkspace: null,
        saveWorkspace: null,
        getCurrentUser: null,
        signIn: null,
        signOut: null,
        onBaseCreated: null,
        onBaseDeleted: null,
        onCollectionCreated: null,
        onCollectionDeleted: null,
        onFieldCreated: null,
        onFieldDeleted: null,
        onRecordCreated: null,
        onRecordUpdated: null,
        onRecordDeleted: null,
        onRecordsImported: null,
        onRecordsExported: null
    },

    get isConfigured() {
        return Boolean(this.config.apiBaseUrl || Object.values(this.hooks).some((hook) => typeof hook === 'function'));
    },

    async loadWorkspace() {
        return typeof this.hooks.loadWorkspace === 'function'
            ? this.hooks.loadWorkspace()
            : null;
    },

    async saveWorkspace(workspace) {
        if (typeof this.hooks.saveWorkspace === 'function') {
            return this.hooks.saveWorkspace(workspace);
        }
        return null;
    },

    async getCurrentUser() {
        return typeof this.hooks.getCurrentUser === 'function'
            ? this.hooks.getCurrentUser()
            : null;
    },

    async request(path, options = {}) {
        if (!this.config.apiBaseUrl) {
            throw new Error('Set BASEFILL_CONFIG.apiBaseUrl before making API requests.');
        }
        const url = new URL(path, this.config.apiBaseUrl).toString();
        const response = await fetch(url, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            ...options
        });
        if (!response.ok) throw new Error(`API request failed (${response.status}).`);
        if (response.status === 204) return null;
        return response.json();
    },

    async emit(hookName, payload) {
        const hook = this.hooks[hookName];
        if (typeof hook === 'function') return hook(payload);
        return null;
    }
};

window.BasefillAPI = BasefillAPI;
