import * as React from "react";
import Subscribable from "../uiComponents/base/Subscribable";
import ClientMediator from "../../ClientMediator";
import { ActiveTransportManager } from "../../helpers/transport";

/**
 * Answers the server's request_targets (the RequestTargets action step): the player picks
 * tokens (or, with target "element", any elements) on the battle map they are looking at (BMService.SetPickTargetsMode), and the
 * picked ids — or { cancelled: true } — go back as input_value. Always mounted (Game.js).
 */
export function handleTargetRequest(resp, { current, setMode, send }) {
  const answer = (data) => send({ command: "input_value", inputToken: resp.inputToken, data });
  const where = current();
  if (!where?.battleMapId || resp.inputToken == null) {
    answer({ cancelled: true });
    return;
  }
  const { message = "", target = "token", min = 1, max = 1, candidates = null } = resp.data ?? {};
  setMode(where.battleMapId, { message, target, min, max, candidates }, (state) =>
    answer(state ? state.picked : { cancelled: true }));
}

export const TargetPickingManager = () => {
  const onMessage = React.useCallback((resp) => handleTargetRequest(resp, {
    current: () => ClientMediator.sendCommand("Game", "GetCurrentBattleMap"),
    setMode: (contextId, request, onDone) =>
      ClientMediator.sendCommand("BattleMap", "SetPickTargetsMode", { contextId, enabled: true, request, onDone }),
    send: (message) => ActiveTransportManager.Send(message),
  }), []);

  return <Subscribable commandPrefix="request_targets" onMessage={onMessage} />;
};

export default TargetPickingManager;
