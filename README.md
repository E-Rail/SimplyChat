# SimplyChat

A simple, encrypted chat application built with Electron and Supabase.

## Features

- **End-to-End Encryption** — Messages encrypted using RSA-OAEP + AES-GCM
- **Email Verification** — Powered by Supabase Auth
- **OAuth Login** — Google and GitHub sign-in support
- **Real-Time Messaging** — Instant message delivery with 5-second polling fallback
- **Contact Management** — Add and manage contacts
- **Cross-Platform** — macOS (Universal) and Windows (x64)

## Download

Download the latest release from the [Releases page](https://github.com/E-Rail/SimplyChat-JS-Edition/releases/latest):

- **macOS** — `SimplyChat-26.1.0-universal.dmg` (Intel & Apple Silicon)
- **Windows** — `SimplyChat Setup 26.1.0.exe` (x64)

> **macOS users:** If you get "SimplyChat is damaged", run this in Terminal after installing:
> ```
> xattr -cr /Applications/SimplyChat.app
> ```

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Desktop**: Electron
- **Encryption**: Web Crypto API (RSA-OAEP + AES-GCM)

## Self-Deployment

### Prerequisites

- Node.js (v16 or higher)
- npm
- A [Supabase](https://supabase.com) project

### 1. Clone and Install

```bash
git clone https://github.com/E-Rail/SimplyChat-JS-Edition.git
cd SimplyChat-JS-Edition
npm install
```

### 2. Set Up Database

1. Go to your Supabase project → **SQL Editor**
2. Run the contents of `src/supabase_setup.sql`

### 3. Configure Supabase

1. Go to **Authentication → Providers** and enable **Email**
2. (Optional) Set up **Google** and **GitHub** OAuth providers
3. Go to **Authentication → URL Configuration** and add `simplychat://auth-callback` to Redirect URLs

### 4. Update Config

Edit `src/config.js` with your Supabase credentials:

```js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### 5. Run

```bash
npm start
```

### 6. Build

```bash
# Mac (Universal)
npm run build:mac

# Windows (x64)
npm run build:win
```

Output saved to `dist/`.

## Project Structure

```
SimplyChat-JS-Edition/
├── main.js              # Electron main process
├── preload.js           # Preload script for renderer
├── package.json         # Project configuration
├── icon.png             # Application icon
├── build.sh             # Build script
├── src/
│   ├── index.html       # Main chat interface
│   ├── login.html       # Login page
│   ├── register.html    # Registration page
│   ├── settings.html    # User settings page
│   ├── auth-callback.html # OAuth callback handler
│   ├── config.js        # App configuration
│   ├── auth.js          # Authentication logic
│   ├── cloudService.js  # Supabase service layer
│   ├── crypto.js        # E2E encryption utilities
│   ├── script.js        # Main application logic
│   ├── style.css        # Application styles
│   ├── debug.js         # Debug utilities
│   └── supabase_setup.sql # Database schema
└── .gitignore
```

## License

MIT
