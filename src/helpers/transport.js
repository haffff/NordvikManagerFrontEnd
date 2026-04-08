// Transport abstraction.
// Both GM and player mode now use WebRTC as the sole real-time transport.
// Import ActiveWebHelper and ActiveTransportManager instead of
// WebHelper / WebSocketManagerInstance in components that need to send
// game commands or tunneled API requests.

import WebRTCWebHelperInstance from './WebRTCWebHelper';
import WebRTCManagerInstance from '../components/game/WebRTCManager';

export const ActiveWebHelper = WebRTCWebHelperInstance;
export const ActiveTransportManager = WebRTCManagerInstance;
