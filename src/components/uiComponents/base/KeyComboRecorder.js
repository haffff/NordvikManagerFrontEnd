import * as React from "react";
import { Button, HStack, IconButton } from "@chakra-ui/react";
import { FaUndo } from "react-icons/fa";
import { CreateActionName } from "../../game/KeyBoardEventsManager";

// Modifier-only keydowns don't finalize a combo — wait for a real key.
const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

/**
 * Click-to-record key combo input. While recording, the next non-modifier
 * keydown is captured via CreateActionName (same format the dispatcher
 * matches against) and reported through onChange. Escape cancels.
 */
export const KeyComboRecorder = ({ value, onChange, onReset, showReset, resetLabel = "Reset to default" }) => {
  const [recording, setRecording] = React.useState(false);

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
