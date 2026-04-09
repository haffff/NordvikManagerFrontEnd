# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install
pnpm start                        # Dev server (Vite)
pnpm start_player                 # Dev server with player role (REACT_APP_MODE=player, port 3001)
pnpm start_gm                     # Dev server with GM role (REACT_APP_MODE=gm, port 3002)
pnpm build                        # Production build (Vite)
pnpm run buildci_gm               # Production build with GM env
pnpm run buildci_player           # Production build with player env
pnpm preview                      # Preview production build (vite preview)
pnpm test                         # Run tests (Vitest)
pnpm test -- <test-path-or-pattern>  # Run a specific test file or pattern
```

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

### Communication Channels

All communication flows through these mechanisms:

1. **`ActiveWebHelper` / `ActiveTransportManager`** (`src/helpers/transport.js`) — **the canonical imports for in-game communication**. Both are thin re-exports that point to the WebRTC implementations. Always import from `transport.js` in components, never import `WebRTCWebHelper` or `WebRTCManager` directly.

2. **`WebRTCWebHelper`** (`src/helpers/WebRTCWebHelper.js`) — REST-over-WebRTC. Mirrors `WebHelper`'s public API (`get`, `post`, `getAsync`, `postAsync`, `deleteAsync`, `getMaterialAsync`, etc.) but tunnels all requests through the WebRTC data channel as `api-request` messages. The GM backend proxies them to the actual HTTP API and sends back `api-response` messages. Requests are queued until the data channel opens.

3. **`WebRTCManager`** (`src/components/game/WebRTCManager.js`) — WebRTC transport. Mirrors the old `WebSocketManager` API (`Subscribe`/`Unsubscribe`/`Send`, `WebSocketReady` flag). Manages the full connection lifecycle: Socket.IO signaling → `RTCPeerConnection` + data channel → offer/answer/ICE → channel open. Injects itself into `WebRTCWebHelper` via `setTransport()`. Large messages are chunked at 15 KB to stay under browser data channel limits.

4. **`CentralWebHelper`** (`src/helpers/CentralWebHelper.js`) — plain fetch-based HTTP client for the **central server** (auth, signaling coordination). Used for login, token refresh, and session management — not for game data. Base URL: `REACT_APP_CENTRAL_URL + "/api"`.

5. **`WebHelper`** (`src/helpers/WebHelper.js`) — original fetch-based REST client. Still used for static resource URL construction (`getResourceString`) and direct HTTP access where WebRTC is not applicable (e.g. material image URLs in `<img src>`). Base URL: `REACT_APP_PROTOCOL + REACT_APP_BASE_URL + "/api"`.

6. **`ClientMediator`** (`src/ClientMediator.js`) — singleton pub/sub command dispatcher for client-side module-to-module communication. Components register a panel name and handle commands via `sendCommand(panel, command, data)`. Use the `useClientMediator` hook (`src/components/uiComponents/hooks/useClientMediator.js`) to register/unregister on mount/unmount.

### WebRTC Connection Flow

```
WebRTCManager.Start(sessionId)
  → SignalingClient (Socket.IO) connects to REACT_APP_CENTRAL_URL
  → authenticate({ token, sessionId, role })
  → SESSION_INFO → gmPeerId known
  → RTCPeerConnection + createDataChannel('game')
  → createOffer → sendOffer via signaling
  → WEBRTC_ANSWER → setRemoteDescription
  → ICE exchange → data channel opens
  → WebSocketReady = true
  → flushes Send() queue + WebRTCWebHelper request queue
```

### State Management

No Redux. State lives in local component state (`useState`), singleton managers (`ClientMediator`, `WebRTCManager`), refs (`useRef` heavily used in `Game.js`), and `DragOptimizationContext` (drag performance only).

### Addons / CardAPI

`src/CardAPI.js` provides a sandboxed API for card addons. It enforces an allowlist of permitted commands. Do not add new commands to card addons without updating the allowlist.

## Key Conventions

### File & Component Naming
- **PascalCase** for component files and feature folders: `LoginPanel.js`, `BattleMap/`
- **camelCase** for utilities and hooks: `WebHelper.js`, `useClientMediator.js`
- Both named and default exports are common in the same file — match the existing pattern in the file you're editing

### In-Game API Calls
Always import `ActiveWebHelper` from `src/helpers/transport.js` for in-game REST calls — never use `WebHelper` directly for game data. `ActiveWebHelper` has the same API surface as `WebHelper`.

### WebRTC Subscriptions (replaces WebSocket)
Always pair `Subscribe` with `Unsubscribe` via `ActiveTransportManager` in a `useEffect` cleanup — same pattern as the old `WebSocketManager`. See `useGameEventHandlers.js` for the canonical pattern.

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
REACT_APP_CENTRAL_URL = ""        # central signaling/auth server
REACT_APP_STUN_SERVER = ""        # defaults to stun:stun.l.google.com:19302
```
All custom env vars must be prefixed `REACT_APP_`.

### Game Master Context
The `isGM` flag gates admin-level actions throughout. Check for it before rendering GM-only UI.

## Key Files

| File | Purpose |
|------|---------|
| `src/App.js` | Entry: auth check, top-level state routing |
| `src/ClientMediator.js` | Singleton command dispatcher |
| `src/helpers/transport.js` | **Canonical import** — exports `ActiveWebHelper` and `ActiveTransportManager` |
| `src/helpers/WebRTCWebHelper.js` | REST-over-WebRTC (mirrors WebHelper API) |
| `src/helpers/WebHelper.js` | HTTP REST client (resource URLs, non-game calls) |
| `src/helpers/CentralWebHelper.js` | Central server HTTP client (auth, token refresh) |
| `src/helpers/SignalingClient.js` | Socket.IO signaling wrapper |
| `src/helpers/TokenStore.js` | JWT access/refresh token storage |
| `src/components/game/WebRTCManager.js` | WebRTC transport (mirrors old WebSocketManager API) |
| `src/components/game/Game.js` | Main game view, initializes all managers |
| `src/components/game/hooks/` | Game lifecycle hooks |
| `src/components/uiComponents/hooks/` | Shared UI hooks |
| `src/CardAPI.js` | Sandboxed addon API |
| `src/stylesheets/` | Global CSS |
