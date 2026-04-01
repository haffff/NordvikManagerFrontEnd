# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Architecture

NordvikManager is a collaborative online tabletop RPG platform. The frontend is a React SPA built around a **dockable panel layout** — there is no React Router. Navigation is purely state-driven:

```
App.js
 ├── LoginPanel          (not logged in)
 ├── RegisterForm        (?code= invite param)
 └── MainApp
      ├── GameList       (no game selected)
      └── Game           (game selected → dockable panel layout)
```

New panels are opened with `Dockable.spawnFloating(...)` from `@hlorenzi/react-dockable` (haffff's fork).

### Three Communication Channels

All inter-component and client–server communication flows through exactly three mechanisms:

1. **`ClientMediator`** (`src/ClientMediator.js`) — singleton pub/sub command dispatcher for client-side module-to-module communication. Components register a panel name and handle commands via `sendCommand(panel, command, data)`. Use the `useClientMediator` hook (`src/components/uiComponents/hooks/useClientMediator.js`) to register/unregister on mount/unmount.

2. **`WebHelper`** (`src/helpers/WebHelper.js`) — fetch-based REST client. Always includes `credentials: "include"`. Base URL: `REACT_APP_PROTOCOL + REACT_APP_BASE_URL + "/api"`, falls back to `/api`.

3. **`WebSocketManager`** (`src/components/game/WebSocketManager.js`) — singleton for real-time game events. Subscribe with `Subscribe(name, handler)`, always `Unsubscribe(name)` on unmount. Two major wrappers: `Subscribable` component and `CollectionSyncer`.

### State Management

No Redux. State lives in local component state (`useState`), singleton managers (`ClientMediator`, `WebSocketManager`), refs (`useRef` heavily used in `Game.js`), and `DragOptimizationContext` (drag performance only).

### Addons / CardAPI

`src/CardAPI.js` provides a sandboxed API for card addons. It enforces an allowlist of permitted commands. Do not add new commands to card addons without updating the allowlist.

## Key Conventions

### File & Component Naming
- **PascalCase** for component files and feature folders: `LoginPanel.js`, `BattleMap/`
- **camelCase** for utilities and hooks: `WebHelper.js`, `useClientMediator.js`
- Both named and default exports are common in the same file — match the existing pattern in the file you're editing

### WebSocket Subscriptions
Always pair `Subscribe` with `Unsubscribe` in a `useEffect` cleanup. See `useGameEventHandlers.js` for the canonical pattern.

### CSS
- Plain CSS files in `src/stylesheets/` for global/shared styles
- Chakra UI (`@chakra-ui/react`) for component-level styling — version **3.5.1**, dark mode default (`initialColorMode: "dark"`). The Chakra `<Provider>` wraps the whole app with `cssVarsRoot="#NordvikManagerMain"`.
- BEM-like class naming prefixed with `.nm_` (e.g., `.nm_basePanel`, `.nm_adminIconButton`)
- `styled-components` is installed but **not used** — do not introduce it

### Environment Variables
Defined in `.env` (committed with dev defaults):
```
REACT_APP_BASE_URL = "localhost:8214"
REACT_APP_PROTOCOL = "https://"
```
All custom env vars must be prefixed `REACT_APP_`.

### Game Master Context
The `isGM` flag gates admin-level actions throughout. Check for it before rendering GM-only UI.

## Key Files

| File | Purpose |
|------|---------|
| `src/App.js` | Entry: auth check, top-level state routing |
| `src/ClientMediator.js` | Singleton command dispatcher |
| `src/helpers/WebHelper.js` | All REST API calls |
| `src/components/game/WebSocketManager.js` | Real-time event bus |
| `src/components/game/Game.js` | Main game view, initializes all managers |
| `src/components/game/hooks/` | Game lifecycle hooks |
| `src/components/uiComponents/hooks/` | Shared UI hooks |
| `src/CardAPI.js` | Sandboxed addon API |
| `src/stylesheets/` | Global CSS |
