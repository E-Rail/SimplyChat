# SimplyChat

A simple, encrypted chat application built with Electron and Supabase.

## Maintenance model

Starting with `26.2.0-core`, this repository is a forkable core rather than a normally maintained consumer-facing app. Developers are expected to own their fork's product experience, backend configuration, security review, and release cadence. Upstream changes are limited to core fixes and starter infrastructure as needed.

## Features

- **End-to-End Encryption** — Messages encrypted using RSA-OAEP + AES-GCM
- **Email Verification** — Powered by Supabase Auth
- **OAuth Login** — Google and GitHub sign-in support
- **Real-Time Messaging** — Instant message delivery with 5-second polling fallback
- **Contact Management** — Add and manage contacts
- **Cross-Platform** — macOS (Universal) and Windows (x64)

## Download

Download the latest release from the [Releases page](https://github.com/E-Rail/SimplyChat-JS-Edition/releases/latest):

- **macOS** — `SimplyChat-26.2.0-core-universal.dmg` (Intel & Apple Silicon)
- **Windows** — `SimplyChat Setup 26.2.0-core.exe` (x64)

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

### 4. Configure the fork

Run the app once with `npm start`. SimplyChat opens the Developer Setup screen when no project is configured. Fill in:

- **Supabase project URL** — for example, `https://your-project.supabase.co`
- **Supabase anon key** — from Supabase → Project Settings → API
- **Optional API base URL** — for any fork-specific services you want to call from the app

The values are stored in the app's local storage for that installation. The public anon key is intended for client-side use; never enter a `service_role` key. Forks that prefer file-based configuration can fill the `DEFAULT_APP_CONFIG` values in `src/config.js` instead.

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
│   ├── setup.html       # First-run developer credential setup
│   ├── setup.js         # Setup form and local config persistence
│   ├── auth-callback.html # OAuth callback handler
│   ├── config.js        # Credential loader and integration placeholders
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
