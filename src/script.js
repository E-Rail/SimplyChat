// Import authentication functions
// Current user information
let currentUser = null;
let messages = [];
let contacts = [];
let currentContact = null;
let messageSubscription = null;

// DOM Elements
const messagesDiv = document.getElementById("messages");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const currentUserSpan = document.getElementById("currentUser");
const contactsListDiv = document.getElementById("contactsList");

// Initialize the app
document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication first
    if (!await checkAuth()) {
        return;
    }
    
    // Get current user
    currentUser = getCurrentUser();
    if (currentUser) {
        currentUserSpan.textContent = currentUser.username;
    }
    
    // Load contacts and messages
    loadContacts(); // Changed to not be async since we're loading from localStorage
    loadMessages();
    renderContacts();
    
    // Setup real-time messaging
    setupRealTimeMessaging();
    
    // Setup add contact button
    setupAddContactButton();
    
    // Setup contact context menu
    setupContactContextMenu();
    
    // Setup voice button
    const voiceBtn = document.querySelector('.voice-btn');
    if (voiceBtn) {
        voiceBtn.addEventListener('click', function() {
            alert('Voice message feature would be implemented here');
        });
    }
});

// Setup real-time messaging
async function setupRealTimeMessaging() {
    await waitForSupabase();
    
    if (cloudServiceInstance && currentUser) {
        // Subscribe to real-time messages
        messageSubscription = cloudServiceInstance.subscribeToMessages(currentUser.accountId, handleNewMessage);
        
        // Poll for messages every 5 seconds as backup
        startMessagePolling();
    }
}

// Polling: fetch messages from server every 5 seconds
function startMessagePolling() {
    setInterval(async () => {
        if (!cloudServiceInstance || !currentUser) return;
        
        try {
            const serverMessages = await cloudServiceInstance.getMessagesForUser(currentUser.accountId);
            
            for (const msg of serverMessages) {
                // handleNewMessage will process and delete from server
                await handleNewMessage(msg);
            }
        } catch (err) {
            console.warn('Polling error:', err);
        }
    }, 5000);
}

// Handle new incoming messages
async function handleNewMessage(message) {
    console.log('Received new message:', message);
    
    // Only process messages meant for us
    if (message.receiver_id !== currentUser.accountId) return;
    
    // Try to decrypt if message is E2E encrypted
    let messageContent = message.content;
    if (message.content && message.content.startsWith('E2E:') && typeof E2E !== 'undefined') {
        try {
            const encryptedData = JSON.parse(message.content.substring(4));
            const privateKey = E2E.getPrivateKey();
            if (privateKey) {
                messageContent = await E2E.decryptMessage(encryptedData, privateKey);
            }
        } catch (decErr) {
            console.warn('Failed to decrypt message:', decErr);
            messageContent = '[Encrypted message]';
        }
    }
    
    // Get sender name from contacts
    const senderContact = contacts.find(c => c.id === message.sender_id);
    const senderName = senderContact ? senderContact.name : 'Unknown';
    
    // Check if this message already exists (avoid duplicates)
    const existingMsg = messages.find(m => 
        m.text === messageContent && 
        m.senderId === message.sender_id && 
        Math.abs(m.timestamp - new Date(message.created_at).getTime()) < 5000
    );
    if (existingMsg) return;
    
    // Create formatted message with unique ID
    const formattedMessage = {
        id: message.id || crypto.randomUUID(),
        text: messageContent,
        senderId: message.sender_id,
        senderName: message.sender_id === currentUser.accountId ? currentUser.username : senderName,
        receiverId: message.receiver_id,
        timestamp: new Date(message.created_at).getTime()
    };
    
    // Check if this message is for the current conversation
    if (currentContact && 
        ((message.sender_id === currentContact.id && message.receiver_id === currentUser.accountId) ||
         (message.sender_id === currentUser.accountId && message.receiver_id === currentContact.id))) {
        
        messages.push(formattedMessage);
        saveMessages();
        addMessageToDOM(formattedMessage);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        // Update contact's last message
        currentContact.lastMessage = messageContent;
        currentContact.timestamp = formattedMessage.timestamp;
        saveContacts();
        renderContacts();
    } else {
        // Message is for a different conversation
        const contactToUpdate = contacts.find(c => c.id === message.sender_id);
        if (contactToUpdate) {
            contactToUpdate.lastMessage = messageContent;
            contactToUpdate.timestamp = formattedMessage.timestamp;
            saveContacts();
            renderContacts();
        }
    }
    
    // Delete message from Supabase after receiving (keep DB minimal)
    if (cloudServiceInstance && message.id) {
        cloudServiceInstance.deleteMessage(message.id);
    }
}

// Load contacts from localStorage (empty by default)
function loadContacts() {
    const savedContacts = localStorage.getItem("contacts");
    if (savedContacts) {
        contacts = JSON.parse(savedContacts);
    } else {
        contacts = []; // Start with empty contacts list
    }
}

// Save contacts to localStorage (contacts are local)
function saveContacts() {
    localStorage.setItem("contacts", JSON.stringify(contacts));
}

// Render contacts list
function renderContacts() {
    contactsListDiv.innerHTML = "";
    contacts.forEach((contact, index) => {
        const contactDiv = document.createElement("div");
        contactDiv.className = "contact-item";
        contactDiv.dataset.index = index; // Add index for context menu
        
        // Get first letter of name for avatar
        const firstLetter = contact.name.charAt(0).toUpperCase();
        
        contactDiv.innerHTML = `
            <div class="contact-avatar">${firstLetter}</div>
            <div class="contact-info">
                <div class="contact-name">${contact.name}</div>
                <div class="contact-last-message">${contact.lastMessage}</div>
            </div>
            <div class="contact-timestamp">${formatTime(contact.timestamp)}</div>
        `;
        contactDiv.addEventListener("click", (event) => selectContact(contact, event));
        contactsListDiv.appendChild(contactDiv);
    });
}

// Select a contact to chat with
function selectContact(contact, event) {
    // Remove active class from all contacts
    document.querySelectorAll('.contact-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to selected contact
    event.currentTarget.classList.add('active');
    
    // Set current contact
    currentContact = contact;
    
    // Load messages for this contact
    loadMessages();
    
    console.log("Selected contact:", contact);
}

// Load messages from localStorage (now all messages are stored locally)
async function loadMessages() {
    if (!currentUser || !currentContact) {
        messages = [];
        renderMessages();
        return;
    }
    
    // Load messages from localStorage
    const conversationKey = getConversationKey(currentUser.accountId, currentContact.id);
    const savedMessages = localStorage.getItem(conversationKey);
    
    if (savedMessages) {
        messages = JSON.parse(savedMessages);
    } else {
        messages = [];
    }
    
    renderMessages();
}

// Save messages to localStorage
function saveMessages() {
    if (currentUser && currentContact) {
        const conversationKey = getConversationKey(currentUser.accountId, currentContact.id);
        localStorage.setItem(conversationKey, JSON.stringify(messages));
    }
}

// Generate a unique key for a conversation between two users
function getConversationKey(user1Id, user2Id) {
    // Sort IDs to ensure consistent key regardless of order
    const ids = [user1Id, user2Id].sort();
    return `conversation_${ids[0]}_${ids[1]}`;
}

// Render all messages
function renderMessages() {
    messagesDiv.innerHTML = "";
    messages.forEach((msg) => {
        addMessageToDOM(msg);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Add a message to the DOM
function addMessageToDOM(msg) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message");
    messageDiv.classList.add(msg.senderId === currentUser.accountId ? "sent" : "received");
    messageDiv.dataset.id = msg.id;
    
    const messageHeader = document.createElement("div");
    messageHeader.classList.add("message-header");
    messageHeader.innerHTML = `
        <span class="sender">${msg.senderName}</span>
    `;
    
    const messageText = document.createElement("div");
    messageText.classList.add("message-text");
    messageText.textContent = msg.text;
    
    const timestamp = document.createElement("div");
    timestamp.classList.add("timestamp");
    timestamp.textContent = formatTime(msg.timestamp);
    
    messageDiv.appendChild(messageHeader);
    messageDiv.appendChild(messageText);
    messageDiv.appendChild(timestamp);
    
    messagesDiv.appendChild(messageDiv);
}

// Format timestamp
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Send a new message
async function sendMessage() {
    const text = input.value.trim();
    if (text === "" || !currentUser || !currentContact) return;
    
    // Add message to UI immediately with unique ID
    const message = {
        id: crypto.randomUUID(),
        text: text,
        senderId: currentUser.accountId,
        senderName: currentUser.username,
        receiverId: currentContact.id,
        timestamp: new Date().getTime()
    };
    
    messages.push(message);
    saveMessages();
    addMessageToDOM(message);
    
    // Update the last message for the active contact
    currentContact.lastMessage = text;
    currentContact.timestamp = new Date().getTime();
    saveContacts();
    renderContacts();
    
    input.value = "";
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    // Attempt to send to cloud as encrypted backup
    try {
        await waitForSupabase();
        if (cloudServiceInstance) {
            // Try to encrypt the message for the recipient
            let contentToSend = text;
            try {
                if (typeof E2E !== 'undefined') {
                    const recipientPublicKey = await E2E.getContactPublicKey(currentContact.id, cloudServiceInstance);
                    if (recipientPublicKey) {
                        const encrypted = await E2E.encryptMessage(text, recipientPublicKey);
                        contentToSend = 'E2E:' + JSON.stringify(encrypted);
                    }
                }
            } catch (encErr) {
                console.warn('Encryption failed, sending plaintext:', encErr);
            }
            
            await cloudServiceInstance.sendMessage(
                currentUser.accountId,
                currentContact.id,
                contentToSend
            );
        }
    } catch (err) {
        console.warn("Could not send message to cloud, but saved locally:", err);
    }
}

// Event Listeners
sendBtn.addEventListener("click", sendMessage);

// Send on ENTER key
input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
});

// ---- Custom Right-Click Menu for Messages ----
const contextMenu = document.createElement("div");
contextMenu.id = "contextMenu";

const menuItems = [
    { text: "Copy", action: copyMessage },
    { text: "Forward", action: forwardMessage },
    { text: "Quote", action: quoteMessage },
    { text: "Delete", action: deleteMessage }
];

menuItems.forEach(item => {
    const menuItem = document.createElement("div");
    menuItem.classList.add("context-menu-item");
    menuItem.textContent = item.text;
    menuItem.addEventListener("click", item.action);
    contextMenu.appendChild(menuItem);
});

document.body.appendChild(contextMenu);

let selectedMessageId = null;

messagesDiv.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    
    let messageElement = event.target;
    while (messageElement && !messageElement.classList.contains("message")) {
        messageElement = messageElement.parentElement;
    }
    
    if (messageElement) {
        selectedMessageId = messageElement.dataset.id;
        
        contextMenu.style.left = event.pageX + "px";
        contextMenu.style.top = event.pageY + "px";
        contextMenu.style.display = "block";
    }
});

// Hide on click elsewhere
document.addEventListener("click", () => {
    contextMenu.style.display = "none";
    contactContextMenu.style.display = "none";
});

// Context Menu Actions
function copyMessage() {
    if (selectedMessageId !== null) {
        const message = messages.find(m => m.id === selectedMessageId);
        if (message) {
            navigator.clipboard.writeText(message.text).then(() => {
                console.log("Message copied to clipboard");
            }).catch(err => {
                console.error("Failed to copy message: ", err);
            });
        }
    }
    contextMenu.style.display = "none";
}

function forwardMessage() {
    if (selectedMessageId !== null) {
        const message = messages.find(m => m.id === selectedMessageId);
        if (message) {
            console.log("Forwarding message:", message.text);
            alert(`Forwarding message: "${message.text}"`);
        }
    }
    contextMenu.style.display = "none";
}

function quoteMessage() {
    if (selectedMessageId !== null) {
        const message = messages.find(m => m.id === selectedMessageId);
        if (message) {
            input.value = `"${message.text}" `;
            input.focus();
        }
    }
    contextMenu.style.display = "none";
}

function deleteMessage() {
    if (selectedMessageId !== null) {
        if (confirm("Are you sure you want to delete this message?")) {
            const index = messages.findIndex(m => m.id === selectedMessageId);
            if (index !== -1) {
                messages.splice(index, 1);
                saveMessages();
                renderMessages();
            }
        }
    }
    contextMenu.style.display = "none";
}

// ---- Custom Right-Click Menu for Contacts ----
const contactContextMenu = document.createElement("div");
contactContextMenu.id = "contactContextMenu";

const contactMenuItems = [
    { text: "Delete Contact", action: deleteContact }
];

contactMenuItems.forEach(item => {
    const menuItem = document.createElement("div");
    menuItem.classList.add("context-menu-item");
    menuItem.textContent = item.text;
    menuItem.addEventListener("click", item.action);
    contactContextMenu.appendChild(menuItem);
});

document.body.appendChild(contactContextMenu);

let selectedContactIndex = null;

function setupContactContextMenu() {
    contactsListDiv.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        
        // Find the contact element that was clicked
        let contactElement = event.target;
        while (contactElement && !contactElement.classList.contains("contact-item")) {
            contactElement = contactElement.parentElement;
        }
        
        if (contactElement) {
            selectedContactIndex = parseInt(contactElement.dataset.index);
            
            contactContextMenu.style.left = event.pageX + "px";
            contactContextMenu.style.top = event.pageY + "px";
            contactContextMenu.style.display = "block";
        }
    });
}

// Contact Context Menu Action
function deleteContact() {
    if (selectedContactIndex !== null) {
        if (confirm("Are you sure you want to delete this contact?")) {
            // Remove contact from contacts array
            contacts.splice(selectedContactIndex, 1);
            saveContacts();
            renderContacts();
            
            // If the deleted contact was the current contact, clear the chat
            if (currentContact && selectedContactIndex === contacts.findIndex(c => c.id === currentContact.id)) {
                currentContact = null;
                messages = [];
                renderMessages();
            }
        }
    }
    contactContextMenu.style.display = "none";
}

// Setup add contact button functionality
function setupAddContactButton() {
    const addContactBtn = document.getElementById('addContactBtn');
    const addContactModal = document.getElementById('addContactModal');
    const cancelAddContact = document.getElementById('cancelAddContact');
    const addContactForm = document.getElementById('addContactForm');
    
    if (addContactBtn) {
        addContactBtn.addEventListener('click', function() {
            addContactModal.style.display = 'block';
        });
    }
    
    if (cancelAddContact) {
        cancelAddContact.addEventListener('click', function() {
            addContactModal.style.display = 'none';
        });
    }
    
    if (addContactForm) {
        addContactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('contactEmail').value;
            addNewContact(email);
        });
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === addContactModal) {
            addContactModal.style.display = 'none';
        }
    });
}

// Add new contact functionality
async function addNewContact(email) {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address');
        return;
    }
    
    // Check if email exists in accounts list
    const allUsers = await getAllUsers();
    let foundUser = null;
    
    for (const username in allUsers) {
        // Skip ABC people and current user
        if (username.toLowerCase().includes('abc') || username === currentUser.username) {
            continue;
        }
        
        if (allUsers[username].email === email) {
            foundUser = allUsers[username];
            break;
        }
    }
    
    if (foundUser) {
        // User exists, add as contact if not already added
        const existingContact = contacts.find(contact => contact.id === foundUser.accountId);
        if (existingContact) {
            alert('This contact is already in your list');
        } else {
            // Add user as contact
            contacts.push({
                id: foundUser.accountId,
                name: foundUser.username,
                email: foundUser.email,
                lastMessage: "No messages yet",
                timestamp: Date.now()
            });
            saveContacts();
            renderContacts();
            alert('Contact added successfully!');
        }
    } else {
        // User doesn't exist, save as local contact
        const existingContact = contacts.find(contact => contact.email === email);
        if (existingContact) {
            alert('This contact is already in your list');
        } else {
            contacts.push({
                id: 'local_' + Date.now(),
                name: email.split('@')[0], // Use part before @ as name
                email: email,
                lastMessage: "No messages yet",
                timestamp: Date.now()
            });
            saveContacts();
            renderContacts();
            alert('Contact saved locally!');
        }
    }
    
    // Close modal and clear form
    document.getElementById('addContactModal').style.display = 'none';
    document.getElementById('contactEmail').value = '';
}