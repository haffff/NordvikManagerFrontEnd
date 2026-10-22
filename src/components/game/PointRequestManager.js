import * as React from "react";
import Subscribable from "../uiComponents/base/Subscribable";
import ClientMediator from "../../ClientMediator";
import { ActiveTransportManager } from "../../helpers/transport";

/**
 * Answers the server's request_point (the RequestPoint action step): the player points at
 * a place on the battle map they are looking at (BMService.SetPickPointMode), and the
 * point — or { cancelled: true } — goes back as input_value. Always mounted (Game.js).
 */
export function handlePointRequest(resp, { current, setMode, send }) {
  const answer = (data) => send({ command: "input_value", inputToken: resp.inputToken, data });
  const where = current();
  const request = resp.data ?? {};
  // The server checks the point is on the map it asked about.
  if (!where?.battleMapId || resp.inputToken == null || (request.mapId && where.mapId && where.mapId !== request.mapId)) {
    answer({ cancelled: true });
    return;
  }
  setMode(where.battleMapId, request, (state) =>
    answer(state?.position ? { ...state.position, mapId: request.mapId ?? where.mapId } : { cancelled: true }));
}

export const PointRequestManager = () => {
  const onMessage = React.useCallback((resp) => handlePointRequest(resp, {
    current: () => ClientMediator.sendCommand("Game", "GetCurrentBattleMap"),
    setMode: (contextId, request, onDone) =>
      ClientMediator.sendCommand("BattleMap", "SetPickPointMode", { contextId, enabled: true, request, onDone }),
    send: (message) => ActiveTransportManager.Send(message),
  }), []);

  return <Subscribable commandPrefix="request_point" onMessage={onMessage} />;
};

export default PointRequestManager;
