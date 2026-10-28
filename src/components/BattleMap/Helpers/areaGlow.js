import { fabric } from "fabric";
import { touchesToken } from "./areaShape";

// Lights up the tokens an area covers (by the area rule, areaShape.js — the ones Find would
// give), in `color`; tokens it doesn't cover go back to their own shadow, kept in
// object[keep] meanwhile. A null area puts them all back. For aiming (RequestPoint) and
// measuring; never token parts or previews, nor `exceptId` (the token a cone starts from,
// which Find leaves out too).
export function glowTokensIn(canvas, area, color, keep, exceptId) {
  canvas.getObjects().forEach((object) => {
    if (!object.tokenData || object.isTokenUI || object.preview) return;
    let covered = false;
    if (area && (exceptId === undefined || object.id !== exceptId)) {
      const c = object.getCenterPoint();
      covered = touchesToken(area, { x: c.x, y: c.y, w: object.getScaledWidth(), h: object.getScaledHeight() });
    }
    glow(object, covered, keep, color);
  });
}

// Where a token keeps its own shadow while another player's area makes it glow (one key per
// player, so their glow and this player's own don't undo each other).
export const remoteGlowKey = (playerId) => `beforeRemoteGlow_${playerId}`;

// What a preview_update carries so the others light up the same tokens: the covered area
// (null: none now), the sender's glow colour, the token it starts from (left out).
export const glowUpdate = (area, color, exceptId) => ({ area: area ?? null, color, exceptId });

// Lights one object up (or back to how it was), keeping its own shadow in object[keep].
export function glow(object, on, keep, color) {
  if (on && object[keep] === undefined) {
    object.set({ [keep]: object.shadow ?? null, shadow: new fabric.Shadow({ color, blur: 25 }) });
  } else if (!on && object[keep] !== undefined) {
    object.set({ shadow: object[keep], [keep]: undefined });
  }
}
