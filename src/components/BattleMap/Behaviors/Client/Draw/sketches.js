import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../../helpers/transport";
import ClientMediator from "../../../../../ClientMediator";
import UtilityHelper from "../../../../../helpers/UtilityHelper";

// Sketches: freehand marks anyone may draw on the map (Tools → Sketch), even without
// Edit on it. They are previews, not map elements — relayed to the others with
// preview_start/preview_end and never saved, so a reload (or joining later) clears them.

const currentPlayerId = () => ClientMediator.sendCommand("Game", "GetCurrentPlayer")?.id;

const endPreviews = (battleMapId, objects) => {
  if (objects.length === 0) return;
  WebSocketManagerInstance.Send({
    command: "preview_end",
    battleMapId,
    data: objects.map((o) => ({ previewId: o.previewId, playerId: o.playerId })),
  });
};

/** Turns a drawn stroke into this player's sketch and shows it to the others. */
export function addSketch(canvas, path, battleMapId) {
  path.set({
    previewId: UtilityHelper.GenerateUUID(),
    playerId: currentPlayerId(),
    sketch: true,
    stayVisible: true,
    selectable: false,
    evented: false,
  });
  canvas.sketches = [...(canvas.sketches ?? []), path];

  if (canvas.freeDrawSketch?.visibleToOthers !== false) {
    WebSocketManagerInstance.Send({ command: "preview_start", battleMapId, data: [path] });
  }
}

/** Removes this player's last sketch still on the map. */
export function undoSketch(canvas, battleMapId) {
  const onCanvas = canvas.getObjects();
  const stack = (canvas.sketches ?? []).filter((s) => onCanvas.includes(s));
  const last = stack.pop();
  canvas.sketches = stack;
  if (!last) return;

  canvas.remove(last);
  endPreviews(battleMapId, [last]);
  canvas.requestRenderAll();
}

/**
 * Removes this player's sketches, or with `everyone` (the GM's "Clear everyone's")
 * every preview on the map — the others' sketches and measurements too.
 */
export function cleanSketches(canvas, battleMapId, { everyone = false } = {}) {
  const me = currentPlayerId();
  const targets = canvas
    .getObjects()
    .filter((o) => o.previewId && (everyone || (o.sketch && o.playerId === me)));

  canvas.remove(...targets);
  canvas.sketches = [];
  endPreviews(battleMapId, targets);
  canvas.requestRenderAll();
}
