// Colours for the action editor, kept in one place so they can be swapped for the app's
// shared theme tokens later.
export const T = {
  surface: "rgb(30,30,30)",
  raised: "rgb(42,42,42)",
  hover: "rgb(52,52,52)",
  selected: "rgba(66,153,225,0.16)",
  border: "rgb(65,65,65)",
  text: "gray.200",
  muted: "gray.500",
  faint: "gray.600",
  token: "#f6c177",       // %variables% in summaries
  missing: "#e07a7a",     // required argument not filled in
  accent: "blue.300",
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
