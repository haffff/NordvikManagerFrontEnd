import { useEffect } from "react";
import { startBlockedNotices, recordServerNotice } from "../../helpers/blockedNotices";
import { ActiveTransportManager } from "../../helpers/transport";
import { resetBlocked } from "../../helpers/addonNetworkLog";
import { loadGameHostInfo } from "../../host/hostInfo";

/**
 * While a game is open: tells GMs when addon code was blocked from reaching somewhere
 * (helpers/blockedNotices.js): what its own cards' policies blocked, and what the GM backend
 * refused for actions. A different game starts a fresh log.
 */
export default function BlockedNoticesManager({ gameId }) {
  useEffect(() => {
    let hostInfo = null;
    let live = true;
    loadGameHostInfo(gameId).then((info) => { if (live) hostInfo = info; });
    const stop = startBlockedNotices(() => hostInfo);
    // The GM backend's word that it refused an action's request (sent to GMs only).
    ActiveTransportManager.Subscribe("BlockedNotices", recordServerNotice);
    return () => {
      live = false;
      ActiveTransportManager.Unsubscribe("BlockedNotices");
      stop();
      resetBlocked();
    };
  }, [gameId]);
  return null;
}
