// SimplyChat Configuration
const SUPABASE_URL = 'https://sklbbmrmhcfjgthexhdf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrbGJibXJtaGNmamd0aGV4aGRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTgwODUsImV4cCI6MjA5MTczNDA4NX0.4ZMuh7z-D1YTpMd8zxiA73qO6a5TWVPNMnlLrcvcQ6g';

// Initialize Supabase client
function initSupabase() {
    if (window.supabaseClient) {
        return window.supabaseClient;
    }
    if (window.supabase) {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        return window.supabaseClient;
    }
    return null;
}
