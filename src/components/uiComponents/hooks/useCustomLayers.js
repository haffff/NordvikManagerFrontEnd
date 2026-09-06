import React from "react";
import { ActiveTransportManager as WebSocketManagerInstance, ActiveWebHelper as WebHelper } from "../../../helpers/transport";
import ClientMediator from "../../../ClientMediator";
import UtilityHelper from "../../../helpers/UtilityHelper";
import { parseListValue } from "../../game/settings/PropertiesSettingsPanel";
import { RESERVED_LAYERS } from "../../BattleMap/Constants/layers";

const LAYER_LIST_PROPERTY_NAME = "customLayers";

// TOKEN_UI is deliberately excluded — it's an internal-only overlay (health
// bars/name labels), never a placeable or selectable layer.
const RESERVED_ROWS = [
  { key: "reserved-token", id: null, name: "Token", layerId: RESERVED_LAYERS.TOKEN, kind: "reserved-token" },
  { key: "reserved-grid", id: null, name: "Grid", layerId: RESERVED_LAYERS.GRID, kind: "reserved-grid" },
  { key: "reserved-map", id: null, name: "Background", layerId: RESERVED_LAYERS.MAP, kind: "reserved-map" },
];

const toCustomLayers = (value) =>
  (parseListValue(value) ?? [])
    .map((item) => ({ key: item.id, id: item.id, name: item.fields?.name ?? "", layerId: Number(item.fields?.layerId), kind: "custom" }))
    .filter((l) => Number.isFinite(l.layerId));

// Topmost-first (descending layerId), matching ordinary layer-panel UX (e.g.
// Photoshop shows the topmost layer at the top of the panel).
const mergeLayers = (customLayers) =>
  [...RESERVED_ROWS, ...customLayers].sort((a, b) => b.layerId - a.layerId);

// Self-contained, live-synced mirror of the game's "customLayers" property list,
// merged with the fixed reserved anchors into one correctly-ordered list — used
// by the Settings layer editor and the battle-map toolbar/context-menu so none
// of them re-implement "reserved first, then customs" separately.
//
// On every update, diffs the previous layer set against the new one BY ITEM ID
// (not by the set of layerId values — a layer's numeric id can now change while
// the row still exists, via a reorder) and fires one batched ReassignLayer call
// covering both "moved to a new layerId" and "deleted -> Map" cases, so an
// already-open canvas never needs a reload to reflect a layer change (the DB
// side already happened atomically on the server).
export const useCustomLayers = (gameId) => {
  const [propertyId, setPropertyId] = React.useState(null);
  const [layers, setLayers] = React.useState(RESERVED_ROWS);
  const prevByIdRef = React.useRef(new Map());

  React.useEffect(() => {
    if (!gameId) return;

    WebHelper.get(
      "properties/QueryProperties?parentIds=" + gameId,
      (data) => {
        const prop = (data ?? []).find(
          (p) => p.name === LAYER_LIST_PROPERTY_NAME && p.entityName === "GameModel"
        );
        const custom = toCustomLayers(prop?.value);
        prevByIdRef.current = new Map(custom.map((l) => [l.id, l.layerId]));
        setPropertyId(prop?.id ?? null);
        setLayers(mergeLayers(custom));
      },
      (error) => console.error("useCustomLayers: load failed", error)
    );

    const subscriptionKey = "customLayers_" + UtilityHelper.GenerateUUID();
    WebSocketManagerInstance.Subscribe(subscriptionKey, (event) => {
      if (!event.command?.startsWith("property")) return;
      const isOurs =
        (event.command === "property_update" || event.command === "property_add") &&
        event.data?.parentId === gameId &&
        event.data?.name === LAYER_LIST_PROPERTY_NAME;
      if (!isOurs) return;

      const custom = toCustomLayers(event.data.value);
      const nextById = new Map(custom.map((l) => [l.id, l.layerId]));

      const mapping = {};
      for (const [itemId, oldLayerId] of prevByIdRef.current) {
        const newLayerId = nextById.get(itemId);
        if (newLayerId === undefined) {
          mapping[oldLayerId] = RESERVED_LAYERS.MAP; // deleted
        } else if (newLayerId !== oldLayerId) {
          mapping[oldLayerId] = newLayerId; // reordered
        }
      }
      if (Object.keys(mapping).length > 0) {
        ClientMediator.sendCommand("BattleMap", "ReassignLayer", { mapping });
      }

      prevByIdRef.current = nextById;
      setPropertyId(event.data.id);
      setLayers(mergeLayers(custom));
    });

    return () => WebSocketManagerInstance.Unsubscribe(subscriptionKey);
  }, [gameId]);

  return { propertyId, layers };
};

export default useCustomLayers;
