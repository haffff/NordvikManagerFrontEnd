// The app's colour palette as CSS variables a custom stylesheet can override
// (see helpers/customStyles.js, and the user guide's
// "Custom styling" page on the docs site: /user-guide/custom-styling). Each falls back to the
// app's own colour, so nothing changes until a stylesheet sets it:
//
//   :root { --nordvik-surface: #1d1726; --nordvik-accent-blue: gold; }
//
// Use these for UI chrome instead of colour literals. Colours that are data
// (a player's colour, a drawn shape's fill) stay as they are.
const v = (name, fallback) => `var(--nordvik-${name}, ${fallback})`;

export const themeColors = Object.freeze({
  // Surfaces, darkest to lightest
  surfaceSunken: v("surface-sunken", "rgb(28,28,28)"), // debug/log panel backgrounds
  background: v("background-color", "rgb(30,30,30)"), // the page and panels (already a theme variable)
  surface: v("surface", "rgb(38,38,38)"), // panel content areas
  surfaceCard: v("surface-card", "rgb(42,42,42)"),
  surfaceRaised: v("surface-raised", "rgb(48,48,48)"), // cards, chat messages
  surfaceHover: v("surface-hover", "rgb(52,52,52)"),
  surfaceStrong: v("surface-strong", "rgb(55,55,55)"),
  border: v("border", "rgb(65,65,65)"),
  divider: v("divider", "rgb(70,70,70)"), // between a panel's header/list/footer

  // Small buttons (play, stop, add…) in the sound, playlist and view panels
  control: v("control", "rgb(45,45,45)"),
  controlBorder: v("control-border", "rgb(90,90,90)"),
  controlHover: v("control-hover", "rgb(70,70,70)"),
  controlStrong: v("control-strong", "rgb(65,65,65)"),

  toolbar: v("toolbar", "black"), // the main toolbar

  // The connection status bar at the bottom of the game
  statusBar: v("status-bar", "rgba(26, 32, 44, 0.95)"),
  statusBarBorder: v("status-bar-border", "rgba(255, 255, 255, 0.08)"),

  // Text
  text: v("text-strong", "rgb(220,220,220)"), // titles
  textSoft: v("text-soft", "rgb(200,200,200)"),
  textMuted: v("text-muted", "rgb(140,140,140)"),
  textSubtle: v("text-subtle", "rgb(130,130,130)"),

  // Accents
  accentBlue: v("accent-blue", "rgb(100,150,230)"),
  accentGreen: v("accent-green", "rgb(80,200,120)"),
  accentRed: v("accent-red", "rgb(220,80,80)"),
  accentGold: v("accent-gold", "rgb(220,180,60)"),

  // Chat
  chatOwn: v("chat-own", "rgb(55,65,85)"), // your own messages' bubble
  chatOwnBorder: v("chat-own-border", "rgb(80,100,140)"),
  inputFocus: v("input-focus", "rgb(100,120,180)"),

  // Dice results in chat
  rollCrit: v("roll-crit", "rgb(72,199,116)"),
  rollFail: v("roll-fail", "rgb(240,80,80)"),
  rollNormal: v("roll-normal", "rgb(200,200,200)"),

  // File drop zones
  dropZone: v("drop-zone", "rgba(66,153,225,0.06)"),
  dropZoneHover: v("drop-zone-hover", "rgba(66,153,225,0.16)"),
});

export default themeColors;
