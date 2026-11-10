import { fabric } from "fabric";
import { TOKEN_UI_LAYER } from "./shared";

// Where a token's parts sit around it.
/** Status icons ("right-top") shown before the rest collapse into "+N" — tokenData.maxStatusIcons overrides. */
const DEFAULT_MAX_STATUS_ICONS = 3;

// Collapsed status icons are hidden apart from `visible`, which property deps, masks
// and drag hiding all set — they'd otherwise undo it, or it them. Hidden this way an
// element is neither drawn nor clickable.
function setOverflowHidden(element, hidden) {
  if (hidden && !element._overflowPatched) {
    element._overflowPatched = true;
    const { isNotVisible, containsPoint } = element;
    element.isNotVisible = function () {
      return !!this._overflowHidden || isNotVisible.call(this);
    };
    element.containsPoint = function (...args) {
      return !this._overflowHidden && containsPoint.apply(this, args);
    };
  }
  element._overflowHidden = hidden;
}

export const tokenLayout = {
  meta: {
    UpdateTokenUIPositions: {
      description:
        "Recalculates and repositions all additional UI objects anchored to a token.",
      args: [{ name: "objectId", type: "string", required: true }],
    },
  },

  methods: {
    // The small "+N" after the status icons, counting the collapsed ones.
    _createOverflowMarker(likeIcon) {
      const size = likeIcon?.getScaledHeight?.() || 16;
      const marker = new fabric.Text("", {
        fontSize: Math.max(8, Math.round(size * 0.6)),
        fontWeight: "bold",
        fill: "white",
        stroke: "rgba(0,0,0,0.8)",
        strokeWidth: 2,
        paintFirst: "stroke",
        selectable: false,
        evented: false,
      });
      marker.layer = TOKEN_UI_LAYER;
      marker.isTokenUI = true;
      marker.tokenData = { anchor: "right-top", overflowMarker: true };
      return marker;
    },

    // ── UI positioning ──────────────────────────────────────────────────────

    /**
     * Recalculate and reposition all additional UI objects anchored to a token.
     */
    UpdateTokenUIPositions({ object, objectId, isCommand }) {
      if (isCommand && !objectId) return "--objectId is required";

      const canvas = this._getCanvas();
      let token = object;

      if (!token && objectId) {
        token = this._findObject(objectId);
      }

      if (!token) {
        console.warn("TokenManager.UpdateTokenUIPositions: token not found");
        return;
      }

      if (!token.additionalObjects?.length) return;

      const map = this._getSelectedMap();
      if (!map?.gridSize) return;

      const { gridSize } = map;
      // Canvas coordinates, also while the token is in a multi-selection: Fabric then
      // keeps the token's own left/top (and getCenterPoint) relative to the selection's
      // centre, which would put its bars near the canvas corner.
      const center = token.group
        ? fabric.util.transformPoint(token.getCenterPoint(), token.group.calcTransformMatrix())
        : token.getCenterPoint();
      const gridSizeScale = gridSize / token.width;
      const currentScale = token.getObjectScaling().scaleX;
      const expectedSize = gridSize * (currentScale / gridSizeScale);
      const halfSize = expectedSize / 2;
      const zero = {
        x: center.x - halfSize,
        y: center.y - halfSize,
      };

      // Status icons stack (see TokenIconPickerOverlay): the icons turned on pack together
      // left to right from their anchor (+ their offset) instead of each sitting at its own
      // authored slot, which would leave a gap where a hidden icon's slot used to be. Parts
      // with tokenData.stack stack at their anchor; "right-top" always stacks (the status
      // icons' corner, from before the flag). Each anchor's stack is its own row.
      // getScaledWidth() is reliable here: _loadSVGElement scales SVG/reactIcon
      // groups to their declared width synchronously before pushing them into
      // additionalObjects, so it's already correct by the time this runs.
      const STACK_GAP = 2;
      const stackOffset = new Map();
      const stacks = new Map();
      for (const element of token.additionalObjects) {
        const td = element?.tokenData;
        if (!td || td.overflowMarker || !(td.stack || td.anchor === "right-top")) continue;
        // While the token is dragged its UI is hidden, with the real visibility kept in
        // visibleBeforeDrag — repositioning then must not pile every icon onto one slot.
        if ((element.visibleBeforeDrag ?? element.visible) === false) continue;
        const anchor = td.anchor ?? "left-top";
        if (!stacks.has(anchor)) stacks.set(anchor, []);
        stacks.get(anchor).push(element);
      }
      const markers = token.additionalObjects.filter((e) => e?.tokenData?.overflowMarker);
      for (const m of markers) if (!stacks.has(m.tokenData.anchor)) setOverflowHidden(m, true);

      // More icons than fit: the first ones, then a small "+N" right after them —
      // all of them while the token is selected on its own (OnTokenSelectedBehavior).
      const max = token.tokenData?.maxStatusIcons;
      const limit = Number.isInteger(max) && max >= 1 ? max : DEFAULT_MAX_STATUS_ICONS;
      for (const [anchor, icons] of stacks) {
        const collapse = icons.length > limit && !token._iconsExpanded;
        const kept = collapse ? icons.slice(0, limit) : icons;
        for (const icon of icons) setOverflowHidden(icon, !kept.includes(icon));

        let marker = markers.find((m) => m.tokenData.anchor === anchor);
        if (collapse && !marker) {
          marker = this._createOverflowMarker(icons[0]);
          marker.tokenData.anchor = anchor;
          marker.uiOf = token;
          token.additionalObjects.push(marker);
          markers.push(marker);
          canvas.add(marker);
        }
        if (marker) setOverflowHidden(marker, !collapse);
        if (collapse) {
          marker.set("text", `+${icons.length - limit}`);
          // Right after the row, centred on it.
          const rowHeight = kept[0].getScaledHeight?.() ?? kept[0].height ?? 0;
          const ownHeight = marker.getScaledHeight?.() ?? marker.height ?? 0;
          marker.tokenData.offsetX = kept[0].tokenData?.offsetX ?? 0;
          marker.tokenData.offsetY = (kept[0].tokenData?.offsetY ?? 0) + (rowHeight - ownHeight) / 2;
        }

        let running = 0;
        for (const element of collapse ? [...kept, marker] : icons) {
          stackOffset.set(element, running);
          running += (element.getScaledWidth?.() ?? element.width ?? 0) + STACK_GAP;
        }
      }

      for (const element of token.additionalObjects) {
        if (element?.tokenData?.ignoreRelativePosition) continue;

        // A part that fits the token (e.g. a ring around it) is as wide as the token is
        // shown, at any token size, keeping its own aspect.
        if (element.tokenData?.fitToToken && element.width > 0) {
          const fit = expectedSize / element.width;
          element.set({ scaleX: fit, scaleY: fit });
        }

        // A stacked icon: its offset plus its place in the row.
        const oX = (element.tokenData?.offsetX ?? 0) + (stackOffset.get(element) ?? 0);
        const oY = element.tokenData?.offsetY ?? 0;

        switch (element.tokenData?.anchor) {
          case "top":
            element.left = zero.x + halfSize + oX;
            element.top = zero.y + oY;
            break;
          case "bottom":
            element.left = center.x + oX;
            element.top = zero.y + expectedSize + oY;
            break;
          case "left":
            element.left = zero.x + oX;
            element.top = zero.y + halfSize + oY;
            break;
          case "right":
            element.left = zero.x + expectedSize + oX;
            element.top = zero.y + halfSize + oY;
            break;
          case "right-top":
            element.left = zero.x + expectedSize + oX;
            element.top = zero.y + oY;
            break;
          case "left-bottom":
            element.left = zero.x + oX;
            element.top = zero.y + expectedSize + oY;
            break;
          case "right-bottom":
            element.left = zero.x + expectedSize + oX;
            element.top = zero.y + expectedSize + oY;
            break;
          case "center":
            element.left = zero.x + halfSize + oX;
            element.top = zero.y + halfSize + oY;
            break;
          case "left-top":
          default:
            element.left = zero.x + oX;
            element.top = zero.y + oY;
            break;
        }
      }

      // Single render call AFTER all repositioning
      canvas.requestRenderAll();
    },
  },
};
