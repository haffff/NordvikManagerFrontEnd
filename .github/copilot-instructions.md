# Copilot Instructions – NordvikManager Frontend

## What This App Is

NordvikManager is a collaborative online tabletop RPG platform. The frontend is a React SPA with a **dockable panel layout** (no traditional router). Players and GMs interact via real-time WebSocket sync, a Fabric.js battle map canvas, a chat system, and an extensible card addon system.

---

## Commands

```bash
npm install --legacy-peer-deps   # Required due to peer dep conflicts
npm start                        # Dev server
npm run build                    # Production build
npm run buildci                  # Build with CI=false (suppresses warning failures)
npm test                         # Jest + React Testing Library
npm test -- --testPathPattern=App  # Run a single test file
```

ESLint runs via `react-scripts` (no separate lint command). Config extends `react-app` and `react-app/jest`.

---

## Architecture

### Three Communication Channels

All inter-component and client–server communication flows through exactly three mechanisms:

1. **`ClientMediator`** (`src/ClientMediator.js`) — singleton pub/sub command dispatcher for client-side module-to-module communication. Components register a panel name and handle commands via `sendCommand(panel, command, data)`.

2. **`WebHelper`** (`src/helpers/WebHelper.js`) — fetch-based REST client. Always includes `credentials: "include"`. Base URL comes from env vars:
   ```
   REACT_APP_PROTOCOL + REACT_APP_BASE_URL + "/api"
   ```
   Falls back to `/api` if env vars are absent.

3. **`WebSocketManager`** (`src/components/game/WebSocketManager.js`) — singleton for real-time game events. Components subscribe with `Subscribe(name, handler)` and must `Unsubscribe(name)` on unmount.

### Navigation / Routing

There is **no React Router**. Navigation is state-driven:

```
App.js
 ├── LoginPanel          (not logged in)
 ├── RegisterForm        (?code= invite param)
 └── MainApp
      ├── GameList       (no game selected)
      └── Game           (game selected → dockable panel layout)
```

New panels are opened with `Dockable.spawnFloating(...)` from `@hlorenzi/react-dockable` (uses haffff's fork).

### State Management

No Redux. State lives in:
- **Local component state** — `useState` for UI state
- **Singleton managers** — `ClientMediator`, `WebSocketManager`, game data managers
- **Refs** — heavy use of `useRef` in `Game.js` for manager instances
- **Context API** — only `DragOptimizationContext` (drag performance)

### Addons / CardAPI

`src/CardAPI.js` provides a sandboxed API for card addons. It enforces an allowlist of permitted commands. Do not add new commands to card addons without updating the allowlist.

---

## Key Conventions

### File & Component Naming
- **PascalCase** for component files and feature folders: `LoginPanel.js`, `BattleMap/`
- **camelCase** for utilities and hooks: `WebHelper.js`, `useClientMediator.js`
- Both named and default exports are common in the same file — match the existing pattern in the file you're editing

### Using ClientMediator in a Component
Components that participate in the command system use the `useClientMediator` hook (`src/components/uiComponents/hooks/useClientMediator.js`). Register on mount, unregister on unmount.

### WebSocket Subscriptions
Always pair `Subscribe` with `Unsubscribe` in a `useEffect` cleanup. See `useGameEventHandlers.js` for the canonical pattern.

### CSS
- Plain CSS files in `src/stylesheets/` for global/shared styles
- Chakra UI (`@chakra-ui/react`) for component-level styling
- BEM-like class naming prefixed with `.nm_` (e.g., `.nm_basePanel`, `.nm_adminIconButton`)
- `styled-components` is installed but **not used** — don't introduce it

### Chakra UI
Version **3.5.1**. Dark mode is the default (`initialColorMode: "dark"`). The Chakra `<Provider>` wraps the whole app with `cssVarsRoot="#NordvikManagerMain"`. Import components destructured from `@chakra-ui/react`.

### Environment Variables
Defined in `.env` (committed with dev defaults):
```
REACT_APP_BASE_URL = "localhost:8214"
REACT_APP_PROTOCOL = "https://"
```
All custom env vars must be prefixed `REACT_APP_`.

### Game Context
The `isGM` flag (Game Master) gates admin-level actions throughout. Check for it before rendering GM-only UI.

---

## Important Files at a Glance

| File | Purpose |
|------|---------|
| `src/App.js` | Entry: auth check, top-level routing |
| `src/ClientMediator.js` | Singleton command dispatcher |
| `src/helpers/WebHelper.js` | All REST API calls |
| `src/components/game/WebSocketManager.js` | Real-time event bus |
| `src/components/game/Game.js` | Main game view, initializes all managers |
| `src/components/game/hooks/` | Game lifecycle hooks |
| `src/components/uiComponents/hooks/` | Shared UI hooks |
| `src/CardAPI.js` | Sandboxed addon API |
| `src/stylesheets/` | Global CSS |
