# Basefill

Basefill is a user-facing data workspace that developers can fork into the core of their own product. Users can create bases, collections, fields, and records, then import or export seed data without needing a backend on day one.

The default app is deliberately useful in demo mode: data is stored locally in the renderer. The integration surface lives in [`src/api.js`](src/api.js), so a fork can add its own authentication, API, database, analytics, or product-specific side effects without rewriting the UI.

## What ships in the core

- User-facing bases, collections, schema, and record management
- Local-first persistence with a ready-to-replace workspace adapter
- JSON and CSV import, JSON copy, and JSON export
- Search, selection, editing, deletion, and required field validation
- A small, dependency-free API contract for backend and auth integrations
- Electron packaging for macOS and Windows

## Run locally

```bash
npm install
npm start
```

The app opens in demo mode. Create a base, add a collection, or import a JSON/CSV payload to try the core workflow.

## Connect a backend

Open [`src/api.js`](src/api.js). It exposes `window.BasefillAPI` with a small set of hooks:

```js
window.BasefillAPI.hooks.loadWorkspace = async () => {
  const response = await fetch('/api/workspace', { credentials: 'include' });
  return response.json();
};

window.BasefillAPI.hooks.saveWorkspace = async (workspace) => {
  await fetch('/api/workspace', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workspace)
  });
};

window.BasefillAPI.hooks.getCurrentUser = async () => {
  const response = await fetch('/api/me', { credentials: 'include' });
  return response.json();
};
```

Available lifecycle hooks include:

- `loadWorkspace`, `saveWorkspace`
- `getCurrentUser`, `signIn`, `signOut`
- `onBaseCreated`, `onBaseDeleted`
- `onCollectionCreated`, `onCollectionDeleted`
- `onFieldCreated`, `onFieldDeleted`
- `onRecordCreated`, `onRecordUpdated`, `onRecordDeleted`
- `onRecordsImported`, `onRecordsExported`

For a configured REST backend, set `window.BASEFILL_CONFIG.apiBaseUrl` and use `BasefillAPI.request(path, options)` as the shared request helper. Keep secrets out of renderer code; use the Electron preload bridge or a secure session for production credentials.

## Build

```bash
# macOS universal build
npm run build:mac

# Windows x64 build
npm run build:win
```

Build output is written to `dist/`.

## Project structure

```text
├── main.js          # Electron main process
├── preload.js       # Safe native bridge for fork-specific capabilities
├── src/
│   ├── index.html   # User-facing app shell and modal surfaces
│   ├── script.js    # Local-first state, rendering, and interaction logic
│   ├── style.css    # Product UI styles
│   └── api.js       # Backend, auth, and lifecycle integration contract
├── icon.png         # App icon asset
└── package.json
```

## License

MIT
