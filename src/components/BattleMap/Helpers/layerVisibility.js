import { RESERVED_LAYERS } from "../Constants/layers";
import CommandFactory from "../Factories/CommandFactory";

// Custom layers can be Visible, GM only (only players who can edit the game see it, faded)
// or Hidden (nobody sees it until it's shown again). Stored as two flags on the
// layer's item in the game's "customLayers" list; each state sets both, so they
// can't contradict each other. Drawn/hidden on the canvas only: the elements still
// reach every browser.

export const LAYER_STATES = Object.freeze([
  { state: "visible", label: "Visible" },
  { state: "gmOnly", label: "GM only" },
  { state: "hidden", label: "Hidden" },
]);

/**
 * The layer an element is drawn and clicked as: token UI belongs to its own token's layer
 * (uiOf, set by TokenManager), hidden, faded and clicked with it; the token layer when it
 * isn't known.
 */
export const drawLayerOf = (obj) =>
  obj.isTokenUI || obj.layer === RESERVED_LAYERS.TOKEN_UI ? obj.uiOf?.layer ?? RESERVED_LAYERS.TOKEN : obj.layer;

export const layerState = (layer) => (layer?.hidden ? "hidden" : layer?.gmOnly ? "gmOnly" : "visible");

export const flagsForState = (state) => ({
  hidden: String(state === "hidden"),
  gmOnly: String(state === "gmOnly"),
});

export const layerFlagUpdate = (propertyId, layer, state) =>
  CommandFactory.CreatePropertyListItemUpdateCommand(propertyId, layer.id, flagsForState(state));

const SUFFIX = { gmOnly: " (GM only)", hidden: " (hidden)", visible: "" };
export const layerLabel = (layer) => `${layer.name}${SUFFIX[layerState(layer)]}`;

/**
 * What this viewer's canvas leaves out (hidden) and draws faded (dimmed), by layerId.
 * "GM only" layers are shown (faded) to whoever may edit the game.
 */
export const layerView = (layers, canEditGame) => {
  const hidden = new Set();
  const dimmed = new Set();
  for (const layer of layers ?? []) {
    if (layer.kind !== "custom") continue;
    const state = layerState(layer);
    if (state === "hidden" || (state === "gmOnly" && !canEditGame)) hidden.add(layer.layerId);
    else if (state === "gmOnly") dimmed.add(layer.layerId);
  }
  return { hidden, dimmed };
};
