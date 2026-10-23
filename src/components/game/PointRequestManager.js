import * as React from "react";
import Subscribable from "../uiComponents/base/Subscribable";
import ClientMediator from "../../ClientMediator";
import { ActiveTransportManager } from "../../helpers/transport";

/**
 * Answers the server's request_point (the RequestPoint action step): the player points at
 * a place on the battle map they are looking at (BMService.SetPickPointMode), and the
 * point — or { cancelled: true } — goes back as input_value. Always mounted (Game.js).
 */
export function handlePointRequest(resp, { current, opened, setMode, send }) {
  const answer = (data) => send({ command: "input_value", inputToken: resp.inputToken, data });
  const request = resp.data ?? {};
  // The server checks the point is on the map it asked about: point on a battle map showing
  // it, the one in focus if it does (with two open, focus may be on the other one).
  const focused = current();
  const where = !request.mapId || !focused?.mapId || focused.mapId === request.mapId
    ? focused
    : (opened?.() ?? []).find((v) => v.mapId === request.mapId) ?? focused;
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
    opened: () => (ClientMediator.sendCommand("Game", "GetOpenedBattleMaps") ?? []).map((v) => ({
      battleMapId: v.id,
      mapId: ClientMediator.sendCommand("BattleMap", "GetSelectedMapID", { contextId: v.id }),
    })),
    setMode: (contextId, request, onDone) =>
      ClientMediator.sendCommand("BattleMap", "SetPickPointMode", { contextId, enabled: true, request, onDone }),
    send: (message) => ActiveTransportManager.Send(message),
  }), []);

  return <Subscribable commandPrefix="request_point" onMessage={onMessage} />;
};

export default PointRequestManager;
