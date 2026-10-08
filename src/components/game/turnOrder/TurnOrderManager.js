import * as React from "react";
import ClientMediator from "../../../ClientMediator";
import { ActiveTransportManager as Transport } from "../../../helpers/transport";
import UtilityHelper from "../../../helpers/UtilityHelper";
import TurnOrderService, { activeMapId } from "./TurnOrderService";
import { getTurnOrderState, setTurnOrderState } from "./turnOrderStore";

/**
 * Always mounted in the game (beside PlaybackManager): registers the "TurnOrder"
 * ClientMediator commands and keeps the turn order of the map on screen up to date
 * in turnOrderStore, firing "TurnOrder:Changed" (with the state) for panels, the
 * battle map and addons. Renders nothing.
 */
export const TurnOrderManager = () => {
  React.useEffect(() => {
    ClientMediator.register(TurnOrderService);
    return () => ClientMediator.unregister(TurnOrderService.id);
  }, []);

  React.useEffect(() => {
    let disposed = false;
    let request = 0;

    // Only the latest refresh may write (a slower earlier one must not overwrite it).
    const refresh = async () => {
      const mine = ++request;
      const mapId = await activeMapId();
      const next = mapId ? await TurnOrderService.GetState({ mapId }).catch(() => null) : null;
      if (disposed || mine !== request) return;
      setTurnOrderState(next);
      ClientMediator.fireEvent("TurnOrder:Changed", next);
    };

    const subscriptionKey = "turn_order_" + UtilityHelper.GenerateUUID();
    Transport.Subscribe(subscriptionKey, (event) => {
      const { command, data } = event ?? {};
      const current = getTurnOrderState();
      if (command?.startsWith("turnorder_")) {
        if (!current || data?.mapId === current.mapId) refresh();
      } else if (command === "element_remove") {
        const id = typeof data === "string" ? data : data?.id;
        if (current?.entries?.some((entry) => entry.elementId === id)) refresh();
      } else if (command === "map_change") {
        refresh();
      }
    });

    const onPanel = ClientMediator.on("ActivePanelChanged", (data) => {
      if (data?.panel === "BattleMap") refresh();
    });

    refresh();

    return () => {
      disposed = true;
      Transport.Unsubscribe(subscriptionKey);
      ClientMediator.off(onPanel);
    };
  }, []);

  return null;
};

export default TurnOrderManager;
