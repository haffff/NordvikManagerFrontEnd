// A floating window asks the dock for a size (ctx.setPreferredSize). One that sizes itself to
// its content, like a battle map to its map, could open bigger than the screen, with its
// edges out of reach for resizing (only docking it helped). Cap it at 4/5 of the screen.
export const MAX_SCREEN_SHARE = 0.8;
const MIN_WIDTH = 240;
const MIN_HEIGHT = 180;

const browserWindow = () => ({
  width: typeof window !== "undefined" ? window.innerWidth : 1280,
  height: typeof window !== "undefined" ? window.innerHeight : 800,
});

/** The size to ask for: the wanted one, at most 4/5 of the screen on each side. */
export function fitFloatingSize(width, height, screen = browserWindow()) {
  const maxWidth = Math.max(MIN_WIDTH, Math.round(screen.width * MAX_SCREEN_SHARE));
  const maxHeight = Math.max(MIN_HEIGHT, Math.round(screen.height * MAX_SCREEN_SHARE));
  return { width: Math.min(width, maxWidth), height: Math.min(height, maxHeight) };
}
