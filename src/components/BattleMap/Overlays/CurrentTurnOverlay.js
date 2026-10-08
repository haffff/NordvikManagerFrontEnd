import * as React from "react";
import * as ReactDOM from "react-dom";
import themeColors from "../../../helpers/themeColors";
import { useTurnOrder } from "../../game/turnOrder/turnOrderStore";

const RING = 4; // px around the token

/**
 * A ring around the token whose turn it is (from the turn order of the map on
 * screen). Drawn as an HTML overlay in Fabric's wrapper div rather than on the token
 * itself, so nothing about it is ever saved with the token. Follows the token through
 * moves, pans and zooms with a light requestAnimationFrame loop (as TokenQuickEditOverlay).
 */
export const CurrentTurnOverlay = ({ canvas }) => {
  const state = useTurnOrder();
  const elementId = state?.entries?.find((entry) => entry.id === state.currentEntryId)?.elementId ?? null;
  const [rect, setRect] = React.useState(null);

  React.useEffect(() => {
    if (!canvas || !elementId) {
      setRect(null);
      return;
    }
    let raf;
    let last = null;
    const tick = () => {
      // Looked up every frame: a token's object can be replaced (e.g. on reload).
      const token = canvas.getObjects().find((o) => o.id === elementId);
      const r = token ? token.getBoundingRect(false, true) : null;
      if (!r !== !last || (r && (r.left !== last.left || r.top !== last.top || r.width !== last.width || r.height !== last.height))) {
        last = r;
        setRect(r);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [canvas, elementId]);

  if (!rect || !canvas?.wrapperEl) return null;

  return ReactDOM.createPortal(
    <div
      aria-label="Current turn"
      className="nm_currentTurn"
      style={{
        position: "absolute",
        left: `${rect.left - RING}px`,
        top: `${rect.top - RING}px`,
        width: `${rect.width + RING * 2}px`,
        height: `${rect.height + RING * 2}px`,
        border: `2px solid ${themeColors.accentGold}`,
        borderRadius: "50%",
        boxShadow: `0 0 12px ${themeColors.accentGold}`,
        pointerEvents: "none",
        zIndex: 5,
        boxSizing: "border-box",
      }}
    />,
    canvas.wrapperEl
  );
};

export default CurrentTurnOverlay;
