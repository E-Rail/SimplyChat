document.addEventListener('DOMContentLoaded', () => {
    const config = window.SimplyChatConfig.get();
    const form = document.getElementById('setupForm');
    const urlInput = document.getElementById('supabaseUrl');
    const keyInput = document.getElementById('supabaseAnonKey');
    const apiInput = document.getElementById('apiBaseUrl');
    const status = document.getElementById('setupStatus');
    const clearButton = document.getElementById('clearConfigBtn');

    urlInput.value = config.supabaseUrl || '';
    keyInput.value = config.supabaseAnonKey || '';
    apiInput.value = config.apiBaseUrl || '';

    if (window.SimplyChatConfig.isConfigured()) {
        status.textContent = 'A project is already configured. Update it here or continue to login.';
        clearButton.hidden = false;
    } else {
        clearButton.hidden = true;
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const nextConfig = {
            supabaseUrl: urlInput.value.trim(),
            supabaseAnonKey: keyInput.value.trim(),
            apiBaseUrl: apiInput.value.trim()
        };

        if (!window.SimplyChatConfig.isValidSupabaseUrl(nextConfig.supabaseUrl)) {
            setStatus('Enter a valid Supabase project URL.', true);
            urlInput.focus();
            return;
        }
        if (nextConfig.supabaseAnonKey.length <= 20) {
            setStatus('Enter the public Supabase anon key from your project settings.', true);
            keyInput.focus();
            return;
        }
        if (nextConfig.apiBaseUrl && !window.SimplyChatConfig.isValidSupabaseUrl(nextConfig.apiBaseUrl)) {
            setStatus('The optional API base URL is not valid.', true);
            apiInput.focus();
            return;
        }

        window.SimplyChatConfig.save(nextConfig);
        window.location.href = 'login.html';
    });

    clearButton.addEventListener('click', () => {
        window.SimplyChatConfig.clear();
        form.reset();
        clearButton.hidden = true;
        setStatus('Saved credentials cleared.');
    });

    function setStatus(message, isError = false) {
        status.textContent = message;
        status.classList.toggle('error', isError);
    }
});
