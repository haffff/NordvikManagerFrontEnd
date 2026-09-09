import * as React from "react";
import { Button, HStack, IconButton } from "@chakra-ui/react";
import { FaUndo } from "react-icons/fa";
import { CreateActionName, setComboRecording } from "../../game/KeyBoardEventsManager";

// Modifier-only keydowns don't finalize a combo — wait for a real key.
const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

/**
 * Click-to-record key combo input. While recording, the next non-modifier
 * keydown is captured via CreateActionName (same format the dispatcher
 * matches against) and reported through onChange. Escape cancels.
 *
 * The game container (Game.js) listens for key events via React synthetic
 * events and fires whatever action is bound to the pressed combo. This
 * component both stops propagation locally and toggles setComboRecording so
 * the KeyboardEventsManager ignores keys for the duration of a capture —
 * otherwise recording e.g. "Ctrl+C" also triggers the "Ctrl+C" action.
 */
export const KeyComboRecorder = ({ value, onChange, onReset, showReset, resetLabel = "Reset to default" }) => {
  const [recording, setRecording] = React.useState(false);
  const clearTimerRef = React.useRef(null);

  // Keep the manager gated while recording, and for one macrotask afterwards so
  // the trailing keyup of the finalizing keydown (which bubbles to the game
  // container a tick later) is ignored too.
  React.useEffect(() => {
    if (recording) {
      if (clearTimerRef.current) { clearTimeout(clearTimerRef.current); clearTimerRef.current = null; }
      setComboRecording(true);
      return;
    }
    clearTimerRef.current = setTimeout(() => {
      setComboRecording(false);
      clearTimerRef.current = null;
    }, 0);
  }, [recording]);

  React.useEffect(() => () => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    setComboRecording(false);
  }, []);

  const handleKeyDown = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();

    if (ev.key === "Escape") {
      setRecording(false);
      return;
    }
    if (MODIFIER_KEYS.has(ev.key)) return;

    onChange(CreateActionName(ev));
    setRecording(false);
  };

  // Swallow key events while recording so nothing else in the tree (least of all
  // the game container's bound-action dispatcher) reacts to the capture.
  const handleKeyUp = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
  };

  return (
    <HStack gap={1}>
      <Button
        size="xs"
        minW="120px"
        variant={recording ? "solid" : "outline"}
        colorPalette={recording ? "blue" : undefined}
        onClick={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        onKeyDown={recording ? handleKeyDown : undefined}
        onKeyUp={recording ? handleKeyUp : undefined}
      >
        {recording ? "Press keys…" : value || "Unbound"}
      </Button>
      {showReset && (
        <IconButton
          aria-label={resetLabel}
          title={resetLabel}
          size="xs"
          variant="ghost"
          onClick={onReset}
        >
          <FaUndo />
        </IconButton>
      )}
    </HStack>
  );
};

export default KeyComboRecorder;
