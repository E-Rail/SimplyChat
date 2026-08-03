// Authentication System using Supabase Auth
let cloudServiceInstance = null;

// Initialize Cloud Service
async function initCloudService() {
    if (cloudServiceInstance) {
        return cloudServiceInstance;
    }

    await waitForSupabase();

    if (window.CloudService) {
        cloudServiceInstance = new window.CloudService();
        return cloudServiceInstance;
    }
    return null;
}

// Wait for Supabase to be available
function waitForSupabase(maxAttempts = 50) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const check = () => {
            if (window.supabase) resolve();
            else if (attempts >= maxAttempts) reject(new Error('Supabase failed to load'));
            else { attempts++; setTimeout(check, 100); }
        };
        check();
    });
}

// Register with email verification
async function register(username, email, password) {
    try {
        const supabase = initSupabase();
        if (!supabase) return { success: false, message: 'Service not available' };

        console.log('[Register] Starting registration for:', email);

        // Check if username is taken (skip if table doesn't exist)
        try {
            const { data: existing } = await supabase
                .from('users')
                .select('username')
                .eq('username', username)
                .single();

            if (existing) {
                return { success: false, message: 'Username already taken' };
            }
        } catch (e) {
            console.log('[Register] users table check skipped:', e.message);
        }

        // Sign up with Supabase Auth
        console.log('[Register] Calling signUp...');
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: { username: username }
            }
        });

        console.log('[Register] signUp result:', { data, error });

        if (error) {
            console.error('[Register] signUp error:', error);
            return { success: false, message: error.message };
        }

        if (data.user && !data.session) {
            console.log('[Register] Email confirmation required. User ID:', data.user.id);
            return {
                success: true,
                needsVerification: true,
                message: 'Registration successful! Please check your email to verify your account before logging in.'
            };
        }

        if (data.session) {
            console.log('[Register] Auto-confirmed, syncing user...');
            await syncUserToTable(data.user, username);
            saveUserSession(data.user, username);
            return { success: true, message: 'Registration successful!' };
        }

        return { success: true, needsVerification: true, message: 'Please check your email to verify your account.' };
    } catch (err) {
        console.error('[Register] Exception:', err);
        return { success: false, message: 'Registration failed: ' + err.message };
    }
}

// Login with email + password
async function login(email, password) {
    try {
        const supabase = initSupabase();
        if (!supabase) return { success: false, message: 'Service not available' };

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            if (error.message.includes('Email not confirmed')) {
                return { success: false, message: 'Please verify your email before logging in. Check your inbox for a confirmation link.' };
            }
            return { success: false, message: error.message };
        }

        // Get username from metadata or users table
        let username = data.user.user_metadata?.username;
        if (!username) {
            const { data: userData } = await supabase
                .from('users')
                .select('username')
                .eq('id', data.user.id)
                .single();
            username = userData?.username || data.user.email.split('@')[0];
        }

        // Ensure user exists in our users table
        await syncUserToTable(data.user, username);
        saveUserSession(data.user, username);

        return { success: true };
    } catch (err) {
        return { success: false, message: 'Login failed: ' + err.message };
    }
}

// Sync auth user to our custom users table
async function syncUserToTable(authUser, username) {
    const supabase = initSupabase();
    if (!supabase) return;

    // Check if user already exists in users table
    const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('id', authUser.id)
        .single();

    if (!existing) {
        await supabase.from('users').insert([{
            id: authUser.id,
            username: username,
            email: authUser.email,
            password: 'managed_by_supabase_auth' // placeholder, not used
        }]);
    }
}

// Save user session to localStorage
function saveUserSession(authUser, username) {
    const userInfo = {
        username: username,
        email: authUser.email,
        accountId: authUser.id
    };
    localStorage.setItem('currentAccount', JSON.stringify(userInfo));
    localStorage.setItem('currentUser', username);
}

// Check authentication status
async function checkAuth() {
    await initCloudService();
    const currentUser = localStorage.getItem('currentUser');
    const currentAccount = localStorage.getItem('currentAccount');

    if (!currentUser || !currentAccount) {
        if (window.location.pathname.includes('index.html')) return false;
        if (!window.location.pathname.includes('login.html') &&
            !window.location.pathname.includes('register.html') &&
            !window.location.pathname.includes('auth-callback.html')) {
            window.location.href = 'login.html';
            return false;
        }
    }
    return true;
}

// Logout
async function logout() {
    const supabase = initSupabase();
    if (supabase) {
        await supabase.auth.signOut();
    }

    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentAccount');
    localStorage.removeItem('contacts');

    if (typeof E2E !== 'undefined') {
        E2E.clearKeys();
    }

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('conversation_') || key.startsWith('pubkey_'))) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    window.location.href = 'login.html';
}

// Get current user
function getCurrentUser() {
    const userStr = localStorage.getItem('currentAccount');
    if (!userStr) return null;
    return JSON.parse(userStr);
}

// Get all users
async function getAllUsers() {
    const cloudService = await initCloudService();
    if (!cloudService) return {};
    return await cloudService.getAllUsers();
}

// Update user profile
async function updateUserProfile(userData) {
    const currentUser = getCurrentUser();
    if (!currentUser) return { success: false, message: 'Not logged in' };

    const cloudService = await initCloudService();
    if (!cloudService) return { success: false, message: 'System not ready' };

    return await cloudService.updateUserProfile(currentUser.accountId, userData);
}

// ---- Form Handlers ----

document.addEventListener('DOMContentLoaded', function() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm && !document.querySelector('#loginModal')) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('password').value;

            const btn = this.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Signing in...';

            const result = await login(email, password);

            if (result.success) {
                window.location.href = 'index.html';
            } else {
                alert(result.message);
                btn.disabled = false;
                btn.textContent = 'Login';
            }
        });
    }

    // Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('regUsername').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            const confirmPassword = document.getElementById('regConfirmPassword').value;

            if (password !== confirmPassword) {
                alert('Passwords do not match');
                return;
            }

            if (password.length < 6) {
                alert('Password must be at least 6 characters');
                return;
            }

            const btn = this.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Creating account...';

            const result = await register(username, email, password);

            if (result.success) {
                alert(result.message);
                window.location.href = 'login.html';
            } else {
                alert(result.message);
                btn.disabled = false;
                btn.textContent = 'Register';
            }
        });
    }

    // Settings form
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        const currentUser = getCurrentUser();
        if (currentUser) {
            document.getElementById('displayName').value = currentUser.username;
            document.getElementById('email').value = currentUser.email || '';
        }

        settingsForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;

            if (newPassword || confirmNewPassword) {
                if (newPassword !== confirmNewPassword) {
                    alert('New passwords do not match');
                    return;
                }
            }

            const updateData = { email: email };
            if (newPassword) updateData.password = newPassword;

            const result = await updateUserProfile(updateData);
            if (result.success) {
                alert('Profile updated successfully');
                window.location.href = 'index.html';
            } else {
                alert(result.message);
            }
        });
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Auth check
    setTimeout(checkAuth, 100);
});
