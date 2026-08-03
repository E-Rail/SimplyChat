/*
 * SimplyChat developer configuration
 *
 * The app has no project-specific credentials baked into the repository.
 * Developers can either fill these defaults in for a fork or use setup.html
 * on first launch. The Supabase anon key is safe for client-side use; never
 * put a service_role key or other privileged secret in this file.
 */

const CONFIG_STORAGE_KEY = 'simplychat_developer_config';
const DEFAULT_APP_CONFIG = {
    supabaseUrl: '',
    supabaseAnonKey: '',
    apiBaseUrl: '',
    redirectUrl: 'simplychat://auth-callback'
};

function readStoredAppConfig() {
    try {
        const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (error) {
        console.warn('[Config] Could not read saved developer config:', error);
        return {};
    }
}

function getAppConfig() {
    return { ...DEFAULT_APP_CONFIG, ...readStoredAppConfig() };
}

const APP_CONFIG = getAppConfig();
const SUPABASE_URL = APP_CONFIG.supabaseUrl;
const SUPABASE_KEY = APP_CONFIG.supabaseAnonKey;
const SUPABASE_ANON_KEY = APP_CONFIG.supabaseAnonKey;

function isValidSupabaseUrl(value) {
    try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname);
    } catch (error) {
        return false;
    }
}

function hasAppConfig(config = APP_CONFIG) {
    return isValidSupabaseUrl(config.supabaseUrl) && String(config.supabaseAnonKey || '').trim().length > 20;
}

function saveAppConfig(nextConfig) {
    const config = {
        ...DEFAULT_APP_CONFIG,
        ...nextConfig,
        supabaseUrl: String(nextConfig.supabaseUrl || '').trim().replace(/\/$/, ''),
        supabaseAnonKey: String(nextConfig.supabaseAnonKey || '').trim(),
        apiBaseUrl: String(nextConfig.apiBaseUrl || '').trim().replace(/\/$/, '')
    };
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    return config;
}

function clearAppConfig() {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
}

// Initialize Supabase client only after a fork has supplied its credentials.
function initSupabase() {
    if (!hasAppConfig()) return null;
    if (window.supabaseClient) return window.supabaseClient;
    if (window.supabase) {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        return window.supabaseClient;
    }
    return null;
}

window.SimplyChatConfig = {
    storageKey: CONFIG_STORAGE_KEY,
    defaults: DEFAULT_APP_CONFIG,
    get: getAppConfig,
    save: saveAppConfig,
    clear: clearAppConfig,
    isConfigured: () => hasAppConfig(getAppConfig()),
    isValidSupabaseUrl
};
