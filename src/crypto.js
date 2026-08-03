// End-to-End Encryption using Web Crypto API (100% free, built into browsers)
// Hybrid encryption: RSA-OAEP for key exchange + AES-GCM for message content

const E2E = {
    // Generate RSA key pair for a user
    async generateKeyPair() {
        const keyPair = await crypto.subtle.generateKey(
            {
                name: 'RSA-OAEP',
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: 'SHA-256'
            },
            true, // extractable
            ['encrypt', 'decrypt']
        );
        return keyPair;
    },

    // Export public key to base64 string (for storing in Supabase)
    async exportPublicKey(publicKey) {
        const exported = await crypto.subtle.exportKey('spki', publicKey);
        return btoa(String.fromCharCode(...new Uint8Array(exported)));
    },

    // Import public key from base64 string
    async importPublicKey(base64Key) {
        const binaryString = atob(base64Key);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return await crypto.subtle.importKey(
            'spki',
            bytes,
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            true,
            ['encrypt']
        );
    },

    // Export private key to base64 string (for storing in localStorage)
    async exportPrivateKey(privateKey) {
        const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
        return btoa(String.fromCharCode(...new Uint8Array(exported)));
    },

    // Import private key from base64 string
    async importPrivateKey(base64Key) {
        const binaryString = atob(base64Key);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return await crypto.subtle.importKey(
            'pkcs8',
            bytes,
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            true,
            ['decrypt']
        );
    },

    // Generate a random AES-256-GCM key
    async generateAESKey() {
        return await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    },

    // Export AES key to base64
    async exportAESKey(key) {
        const exported = await crypto.subtle.exportKey('raw', key);
        return btoa(String.fromCharCode(...new Uint8Array(exported)));
    },

    // Import AES key from base64
    async importAESKey(base64Key) {
        const binaryString = atob(base64Key);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return await crypto.subtle.importKey(
            'raw',
            bytes,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    },

    // Encrypt a message for a recipient (hybrid: AES + RSA)
    async encryptMessage(plaintext, recipientPublicKeyBase64) {
        // 1. Import recipient's public key
        const recipientPublicKey = await this.importPublicKey(recipientPublicKeyBase64);

        // 2. Generate a random AES key for this message
        const aesKey = await this.generateAESKey();

        // 3. Generate random IV
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // 4. Encrypt the message with AES-GCM
        const encoded = new TextEncoder().encode(plaintext);
        const encryptedContent = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            aesKey,
            encoded
        );

        // 5. Export the AES key to raw bytes
        const rawAESKey = await crypto.subtle.exportKey('raw', aesKey);

        // 6. Encrypt the AES key with recipient's RSA public key
        const encryptedAESKey = await crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            recipientPublicKey,
            rawAESKey
        );

        // 7. Return everything as base64
        return {
            encryptedMessage: btoa(String.fromCharCode(...new Uint8Array(encryptedContent))),
            encryptedAESKey: btoa(String.fromCharCode(...new Uint8Array(encryptedAESKey))),
            iv: btoa(String.fromCharCode(...new Uint8Array(iv)))
        };
    },

    // Decrypt a message (hybrid: RSA + AES)
    async decryptMessage(encryptedData, privateKeyBase64) {
        try {
            // 1. Import our private key
            const privateKey = await this.importPrivateKey(privateKeyBase64);

            // 2. Decode base64 values
            const encryptedContent = Uint8Array.from(atob(encryptedData.encryptedMessage), c => c.charCodeAt(0));
            const encryptedAESKey = Uint8Array.from(atob(encryptedData.encryptedAESKey), c => c.charCodeAt(0));
            const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0));

            // 3. Decrypt the AES key with our RSA private key
            const rawAESKey = await crypto.subtle.decrypt(
                { name: 'RSA-OAEP' },
                privateKey,
                encryptedAESKey
            );

            // 4. Import the decrypted AES key
            const aesKey = await crypto.subtle.importKey(
                'raw',
                rawAESKey,
                { name: 'AES-GCM', length: 256 },
                true,
                ['decrypt']
            );

            // 5. Decrypt the message content
            const decryptedContent = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                aesKey,
                encryptedContent
            );

            return new TextDecoder().decode(decryptedContent);
        } catch (err) {
            console.error('Decryption failed:', err);
            return '[Encrypted message - unable to decrypt]';
        }
    },

    // Check if user has encryption keys
    hasKeys() {
        return !!localStorage.getItem('e2e_private_key');
    },

    // Get stored private key
    getPrivateKey() {
        return localStorage.getItem('e2e_private_key');
    },

    // Store private key
    async storePrivateKey(privateKey) {
        const exported = await this.exportPrivateKey(privateKey);
        localStorage.setItem('e2e_private_key', exported);
    },

    // Store public key locally too (for self-encryption reference)
    async storePublicKey(publicKey) {
        const exported = await this.exportPublicKey(publicKey);
        localStorage.setItem('e2e_public_key', exported);
    },

    // Get stored public key
    getPublicKey() {
        return localStorage.getItem('e2e_public_key');
    },

    // Initialize keys for a new user (generate + store + upload)
    async initializeKeys(userId, cloudService) {
        // Check if keys already exist
        if (this.hasKeys()) {
            console.log('E2E keys already exist');
            return true;
        }

        console.log('Generating new E2E key pair...');
        const keyPair = await this.generateKeyPair();

        // Store locally
        await this.storePrivateKey(keyPair.privateKey);
        await this.storePublicKey(keyPair.publicKey);

        // Upload public key to Supabase
        const publicKeyBase64 = await this.exportPublicKey(keyPair.publicKey);
        await cloudService.storePublicKey(userId, publicKeyBase64);

        console.log('E2E keys initialized and uploaded');
        return true;
    },

    // Get a contact's public key from Supabase
    async getContactPublicKey(contactId, cloudService) {
        // Check cache first
        const cacheKey = `pubkey_${contactId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) return cached;

        // Fetch from Supabase
        const publicKey = await cloudService.getPublicKey(contactId);
        if (publicKey) {
            localStorage.setItem(cacheKey, publicKey);
            return publicKey;
        }
        return null;
    },

    // Clear all encryption keys (on logout)
    clearKeys() {
        localStorage.removeItem('e2e_private_key');
        localStorage.removeItem('e2e_public_key');
        // Clear cached public keys
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('pubkey_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }
};
