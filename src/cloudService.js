// Supabase Service Integration
class CloudService {
    constructor() {
        // Initialize Supabase client via config
        if (typeof initSupabase === 'function') {
            this.supabase = initSupabase();
        } else if (window.supabaseClient) {
            this.supabase = window.supabaseClient;
        } else {
            console.error('Supabase not available. Ensure config.js and supabase CDN are loaded.');
            this.supabase = null;
        }
        console.log('CloudService initialized with supabase client:', !!this.supabase);
    }
    
    // User Registration
    async registerUser(username, email, password) {
        try {
            console.log('Attempting to register user:', username, email);
            
            // Check if supabase is properly initialized
            if (!this.supabase) {
                console.error('Supabase not initialized');
                return { success: false, message: 'Database connection not available' };
            }
            
            // First check if username or email already exists
            const { data: existingUsers, error: checkError } = await this.supabase
                .from('users')
                .select('*')
                .or(`username.eq.${username},email.eq.${email}`);
            
            if (checkError) {
                console.error('Error checking existing users:', checkError);
                return { success: false, message: 'Database error: ' + checkError.message };
            }
            
            if (existingUsers && existingUsers.length > 0) {
                return { success: false, message: 'Username or email already exists' };
            }
            
            // Insert into users table
            const { data, error } = await this.supabase
                .from('users')
                .insert([
                    {
                        username: username,
                        email: email,
                        password: password // In production, use proper hashing
                    }
                ])
                .select();
            
            if (error) {
                console.error('Error inserting user:', error);
                return { success: false, message: 'Registration failed: ' + error.message };
            }
            
            console.log('Registration successful:', data);
            return { success: true, message: 'Registration successful', user: data[0] };
        } catch (err) {
            console.error('Registration error:', err);
            return { success: false, message: 'Registration failed: ' + err.message };
        }
    }
    
    // User Login
    async loginUser(username, password) {
        try {
            console.log('Attempting to login user:', username);
            
            // Check if supabase is properly initialized
            if (!this.supabase) {
                console.error('Supabase not initialized');
                return { success: false, message: 'Database connection not available' };
            }
            
            // Get user by username
            const { data: userData, error: userError } = await this.supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .single();
            
            if (userError || !userData) {
                console.error('User not found or error:', userError);
                return { success: false, message: 'Invalid username or password' };
            }
            
            // Check password (in production, use proper password hashing)
            if (userData.password !== password) {
                return { success: false, message: 'Invalid username or password' };
            }
            
            return { 
                success: true, 
                user: {
                    username: userData.username,
                    email: userData.email,
                    accountId: userData.id
                }
            };
        } catch (err) {
            console.error('Login error:', err);
            return { success: false, message: 'Login failed: ' + err.message };
        }
    }
    
    // Update User Profile
    async updateUserProfile(accountId, userData) {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .update(userData)
                .eq('id', accountId)
                .select();
            
            if (error) {
                return { success: false, message: error.message };
            }
            
            return { success: true, message: 'Profile updated successfully', user: data[0] };
        } catch (err) {
            return { success: false, message: 'Update failed: ' + err.message };
        }
    }
    
    // Get all users (for contacts), excluding ABC people
    async getAllUsers() {
        try {
            // Get all users except those with "ABC" in their username
            const { data, error } = await this.supabase
                .from('users')
                .select('*')
                .not('username', 'ilike', '%ABC%');
            
            if (error) {
                console.error('Error fetching users:', error);
                return {};
            }
            
            const users = {};
            data.forEach(user => {
                users[user.username] = {
                    username: user.username,
                    email: user.email,
                    accountId: user.id
                };
            });
            
            return users;
        } catch (err) {
            console.error('Error in getAllUsers:', err);
            return {};
        }
    }
    
    // Get User by Account ID
    async getUserByAccountId(accountId) {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', accountId)
                .single();
            
            if (error) {
                return null;
            }
            
            return data;
        } catch (err) {
            return null;
        }
    }
    
    // Send a message
    async sendMessage(senderId, receiverId, content) {
        try {
            const { data, error } = await this.supabase
                .from('messages')
                .insert([
                    {
                        sender_id: senderId,
                        receiver_id: receiverId,
                        content: content
                    }
                ])
                .select();
            
            if (error) {
                console.error('Error sending message:', error);
                return { success: false, message: error.message };
            }
            
            return { success: true, message: data[0] };
        } catch (err) {
            console.error('Error sending message:', err);
            return { success: false, message: err.message };
        }
    }
    
    // Delete a message from Supabase (after receiver has it)
    async deleteMessage(messageId) {
        try {
            const { error } = await this.supabase
                .from('messages')
                .delete()
                .eq('id', messageId);
            
            if (error) {
                console.error('Error deleting message:', error);
            }
        } catch (err) {
            console.error('Error deleting message:', err);
        }
    }
    
    // Get all pending messages for a user (for polling fallback)
    async getMessagesForUser(userId) {
        try {
            const { data, error } = await this.supabase
                .from('messages')
                .select('*')
                .eq('receiver_id', userId)
                .order('created_at', { ascending: true });
            
            if (error) {
                console.error('Error fetching messages:', error);
                return [];
            }
            
            return data || [];
        } catch (err) {
            console.error('Error fetching messages:', err);
            return [];
        }
    }
    
    // Get messages between two users
    async getMessagesBetweenUsers(userId1, userId2) {
        try {
            const { data, error } = await this.supabase
                .from('messages')
                .select(`
                    *,
                    sender:users!messages_sender_id_fkey(username),
                    receiver:users!messages_receiver_id_fkey(username)
                `)
                .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
                .order('created_at', { ascending: true });
            
            if (error) {
                console.error('Error fetching messages:', error);
                // Try alternative approach without joins
                const { data: altData, error: altError } = await this.supabase
                    .from('messages')
                    .select('*')
                    .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
                    .order('created_at', { ascending: true });
                
                if (altError) {
                    return { success: false, message: altError.message, data: [] };
                }
                
                return { success: true, data: altData };
            }
            
            return { success: true, data: data };
        } catch (err) {
            console.error('Error fetching messages:', err);
            return { success: false, message: err.message, data: [] };
        }
    }
    
    // Subscribe to real-time messages
    subscribeToMessages(userId, callback) {
        try {
            // Subscribe to messages where the user is either sender or receiver
            const subscription = this.supabase
                .channel('messages')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `sender_id=eq.${userId}`
                    },
                    (payload) => {
                        callback(payload.new);
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `receiver_id=eq.${userId}`
                    },
                    (payload) => {
                        callback(payload.new);
                    }
                )
                .subscribe();
            
            return subscription;
        } catch (err) {
            console.error('Error subscribing to messages:', err);
            return null;
        }
    }
    
    // Store user's public key for E2E encryption
    async storePublicKey(userId, publicKeyBase64) {
        try {
            // Check if key already exists
            const { data: existing } = await this.supabase
                .from('public_keys')
                .select('id')
                .eq('user_id', userId)
                .single();
            
            if (existing) {
                // Update existing key
                const { error } = await this.supabase
                    .from('public_keys')
                    .update({ public_key: publicKeyBase64 })
                    .eq('user_id', userId);
                
                if (error) {
                    console.error('Error updating public key:', error);
                    return false;
                }
            } else {
                // Insert new key
                const { error } = await this.supabase
                    .from('public_keys')
                    .insert([{ user_id: userId, public_key: publicKeyBase64 }]);
                
                if (error) {
                    console.error('Error storing public key:', error);
                    return false;
                }
            }
            
            console.log('Public key stored successfully');
            return true;
        } catch (err) {
            console.error('Error in storePublicKey:', err);
            return false;
        }
    }
    
    // Get a user's public key for E2E encryption
    async getPublicKey(userId) {
        try {
            const { data, error } = await this.supabase
                .from('public_keys')
                .select('public_key')
                .eq('user_id', userId)
                .single();
            
            if (error || !data) {
                console.log('No public key found for user:', userId);
                return null;
            }
            
            return data.public_key;
        } catch (err) {
            console.error('Error getting public key:', err);
            return null;
        }
    }
}

// Create a global instance
window.CloudService = CloudService;