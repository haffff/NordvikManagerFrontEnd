// The colours of an area on the map (aiming with RequestPoint, measuring) and of the tokens
// it lights up: the colour of the player who aims or measures, else the theme's
// (the CSS variable --nm-area-color, which a theme addon can set), else orange. The server
// gives markers the same default (the action's Color, else the player's).

const DEFAULT = [255, 120, 0];

// #rgb, #rrggbb, rgb(…) or rgba(…) as [r, g, b]; null for anything else, and for a fully
// see-through colour (what a player without one gets).
export function parseRgb(color) {
  if (typeof color !== "string") return null;
  const c = color.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((ch) => ch + ch).join("") : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c);
  if (rgb) {
    if (rgb[4] !== undefined && Number(rgb[4]) === 0) return null;
    const parts = [rgb[1], rgb[2], rgb[3]].map(Number);
    if (parts.every((v) => v <= 255)) return parts;
  }
  return null;
}

function themeColor() {
  try {
    const root = document.getElementById("NordvikManagerMain") ?? document.documentElement;
    return getComputedStyle(root).getPropertyValue("--nm-area-color") || getComputedStyle(document.documentElement).getPropertyValue("--nm-area-color");
  } catch {
    return undefined;
  }
}

export function areaColors(baseColor) {
  const [r, g, b] = parseRgb(baseColor) ?? parseRgb(themeColor()) ?? DEFAULT;
  return { stroke: `rgb(${r},${g},${b})`, fill: `rgba(${r},${g},${b},0.25)`, glow: `rgba(${r},${g},${b},0.95)` };
}
