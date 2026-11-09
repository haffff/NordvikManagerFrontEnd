import { fabric } from "fabric";
import TokenManager from "../components/BattleMap/Managers/TokenManager";
import { buildToken } from "../helpers/buildToken";
import { ActiveWebHelper } from "../helpers/transport";
import { SYSTEM_ASSET_KEYS } from "../helpers/systemAssets";
import { PREVIEW_IDS } from "./previewPanels";
import { pointToAnchorOffset } from "./dragDrop";

// The token editor's preview: the token file built as the server builds it (buildToken)
// and drawn by the real TokenManager, as if placed from a card — so its parts read the
// card's and the token's properties, which previewPanels answers with sample values.

const enlivenFabric = (object) =>
  new Promise((resolve) => fabric.util.enlivenObjects([object], ([enlivened]) => resolve(enlivened)));

/**
 * @param canvas  a Fabric canvas (or the part of one TokenManager uses)
 * @param enliven (object) => Promise<fabric object>; tests swap in a stand-in for the picture
 */
export function createPreviewSession({ canvas, enliven = enlivenFabric }) {
  const manager = new TokenManager({ getCanvas: () => canvas });
  let token = null;
  let selected = false;
  // Each place takes a ticket; one overtaken by a newer place (or by dispose) while it
  // loads drops what it made. Every placed token has the same id (previewPanels answers
  // its properties by it), so the older one's parts must not stay behind.
  let ticket = 0;
  // Arrange mode: the token's parts can be dragged; a finished drag is reported as the
  // part's new anchor and offset (the editor writes it into the token file).
  let arrange = false;
  let onMoved = null;

  const tokenRect = () => {
    const centre = token.getCenterPoint();
    // As TokenManager measures it (UpdateTokenUIPositions: the token as shown).
    const size = token.width * (token.scaleX ?? 1);
    return { x: centre.x - size / 2, y: centre.y - size / 2, size };
  };

  // Fabric finds what's under the pointer by each object's stored corners. TokenManager
  // moves parts by setting left/top only (in a game the map's pan and zoom refresh the
  // corners), so after every move the preview refreshes them, or parts can't be grabbed
  // or clicked where they're drawn.
  const syncCoords = () => {
    if (!token) return;
    token.setCoords?.();
    for (const element of token.additionalObjects ?? []) element.setCoords?.();
  };

  const applyArrange = () => {
    for (const element of token?.additionalObjects ?? []) {
      element.set({
        selectable: arrange, evented: true, hasControls: false, hasBorders: arrange,
        lockScalingX: true, lockScalingY: true, lockRotation: true, hoverCursor: arrange ? "move" : null,
      });
    }
    syncCoords();
    canvas.requestRenderAll();
  };

  const onModified = ({ target } = {}) => {
    if (!arrange || !token || !target || !token.additionalObjects?.includes(target)) return;
    onMoved?.(target.name, pointToAnchorOffset({ x: target.left, y: target.top }, tokenRect()));
  };
  canvas.on("object:modified", onModified);

  const clear = () => {
    if (!token) return;
    canvas.remove(...(token.additionalObjects ?? []), token);
    token = null;
  };

  return {
    token: () => token,
    manager,
    tokenRect: () => (token ? tokenRect() : null),
    isArranging: () => arrange,

    /** Arrange mode on or off; onMovedPart(name, { anchor, offsetX, offsetY }) after a drag. */
    setArrange(value, onMovedPart = null) {
      arrange = !!value;
      onMoved = onMovedPart;
      applyArrange();
    },

    /** Draws a token file; options: { gridSize, size (cells), name, imageKey }. */
    async place(definition, { gridSize = 50, size = 1, name = "Token", imageKey = null } = {}) {
      const side = (gridSize > 0 ? gridSize : 50) * size;
      const x = Math.round((canvas.getWidth() - side) / 2);
      const y = Math.round((canvas.getHeight() - side) / 2);
      const { object } = buildToken(definition, {
        gridSize, size, name, x, y, mapId: PREVIEW_IDS.map, cardId: PREVIEW_IDS.card, image: imageKey,
      });
      object.src = ActiveWebHelper.getResourceString(null, imageKey ?? SYSTEM_ASSET_KEYS.EMPTY_TOKEN_IMAGE);

      const mine = ++ticket;
      const placed = await enliven(object);
      if (mine !== ticket) return;
      placed.id = PREVIEW_IDS.token;
      placed.isToken = true;
      placed.tokenData = object.tokenData;
      placed.tokenUiElements = object.tokenUiElements;
      placed.selectable = false;
      placed._controlsShown = selected;
      placed._iconsExpanded = selected;

      clear();
      token = placed;
      canvas.add(token);
      await manager.CanvasObjectLoadToken({ id: placed.id });
      if (mine !== ticket) {
        canvas.remove(...(placed.additionalObjects ?? []));
        return;
      }
      applyArrange();
      await this.refresh();
    },

    /** Applies the current sample values again. */
    async refresh() {
      if (!token) return;
      await manager.UpdateTokenBasedOnProperties({ tokenId: token.id });
      syncCoords();
      canvas.requestRenderAll();
    },

    /** As if the token were selected on its own: on-control parts and every status icon show. */
    async setSelected(value) {
      selected = !!value;
      if (!token) return;
      token._controlsShown = selected;
      token._iconsExpanded = selected;
      await this.refresh();
      manager.UpdateTokenUIPositions({ object: token });
      syncCoords();
    },

    dispose() {
      ticket++;
      clear();
      canvas.off("object:modified", onModified);
    },
  };
}
