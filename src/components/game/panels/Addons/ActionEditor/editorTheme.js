// Colours for the action editor, taken from the app theme (helpers/themeColors.js) so
// custom stylesheets restyle the editor too.
import { themeColors } from "../../../../../helpers/themeColors";

export const T = {
  surface: themeColors.background,
  raised: themeColors.surfaceCard,
  hover: themeColors.surfaceHover,
  selected: "rgba(66,153,225,0.16)", // no theme token for a selected row yet
  border: themeColors.border,
  text: themeColors.text,
  muted: themeColors.textMuted,
  faint: themeColors.textSubtle,
  token: themeColors.accentGold,     // %variables% in summaries
  missing: themeColors.accentRed,    // required argument not filled in
  accent: themeColors.accentBlue,
};

// Type chip colour per step category (anything else falls back to gray).
const CATEGORY_COLORS = {
  "Control Flow": "purple",
  Script: "pink",
  Math: "cyan",
  Collection: "cyan",
  Properties: "green",
  Data: "teal",
  Map: "orange",
  Roll: "yellow",
  Client: "blue",
  Audio: "blue",
  Network: "red",
  Security: "red",
  WebSockets: "gray",
};

export const categoryColor = (category) => CATEGORY_COLORS[category] ?? "gray";
