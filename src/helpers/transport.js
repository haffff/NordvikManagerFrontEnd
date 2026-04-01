// Transport abstraction.
// Import ActiveWebHelper and ActiveTransportManager instead of
// WebHelper / WebSocketManagerInstance in components that must work in
// both GM and player modes.

import WebHelper from './WebHelper';
import WebRTCWebHelperInstance from './WebRTCWebHelper';
import WebSocketManagerInstance from '../components/game/WebSocketManager';
import WebRTCManagerInstance from '../components/game/WebRTCManager';

const IS_PLAYER_MODE = process.env.REACT_APP_MODE === 'player';

export const ActiveWebHelper = IS_PLAYER_MODE ? WebRTCWebHelperInstance : WebHelper;
export const ActiveTransportManager = IS_PLAYER_MODE ? WebRTCManagerInstance : WebSocketManagerInstance;
