import * as React from "react";
import ClientMediator from "../../../ClientMediator";
import { ActiveTransportManager as Transport } from "../../../helpers/transport";
import UtilityHelper from "../../../helpers/UtilityHelper";
import { playSystemSound, SYSTEM_ASSET_KEYS } from "../../../helpers/systemAssets";
import TurnOrderService, { activeMapId } from "./TurnOrderService";
import { getTurnOrderState, setTurnOrderState } from "./turnOrderStore";

/**
 * Whether `next` is a new turn of this player's: on the same map as before, the turn
 * moved on (another entry, or a new round), and the player may end it — i.e. the current
 * token is theirs. Not on load or a map switch, and never for the GM, who may end every turn.
 */
export const isNewTurnForPlayer = (previous, next, isGM) =>
  !isGM &&
  !!previous &&
  !!next?.canEndTurn &&
  next.currentEntryId != null &&
  previous.mapId === next.mapId &&
  (previous.currentEntryId !== next.currentEntryId || previous.round !== next.round);

/**
 * Always mounted in the game (beside PlaybackManager): registers the "TurnOrder"
 * ClientMediator commands and keeps the turn order of the map on screen up to date
 * in turnOrderStore, firing "TurnOrder:Changed" (with the state) for panels, the
 * battle map and addons. Renders nothing.
 */
export const TurnOrderManager = ({ isGM = false }) => {
  const isGMRef = React.useRef(isGM);
  isGMRef.current = isGM;

  React.useEffect(() => {
    ClientMediator.register(TurnOrderService);
    return () => ClientMediator.unregister(TurnOrderService.id);
  }, []);

  React.useEffect(() => {
    let disposed = false;
    let request = 0;
    // What this mount last saw (the store outlives a game, so it can't tell "new turn").
    let previous = null;

    // Only the latest refresh may write (a slower earlier one must not overwrite it).
    const refresh = async () => {
      const mine = ++request;
      const mapId = await activeMapId();
      const next = mapId ? await TurnOrderService.GetState({ mapId }).catch(() => null) : null;
      if (disposed || mine !== request) return;
      setTurnOrderState(next);
      // Like the chat sound: plays the GM's uploaded "Your turn" sound, if there is one.
      if (isNewTurnForPlayer(previous, next, isGMRef.current)) playSystemSound(SYSTEM_ASSET_KEYS.TURN_SOUND);
      previous = next;
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
