import * as React from "react";
import { HStack, Text } from "@chakra-ui/react";

/**
 * A compact 0–100% volume slider. onCommit(0..1) is called once the slider is let go
 * (or after a keyboard change), not on every step of a drag, so a saved volume
 * isn't sent to the server dozens of times.
 */
export const VolumeSlider = ({ label, value = 1, onCommit, width = "90px" }) => {
  const percent = Math.round((value ?? 1) * 100);
  const [current, setCurrent] = React.useState(percent);
  const committed = React.useRef(percent);

  React.useEffect(() => {
    setCurrent(percent);
    committed.current = percent;
  }, [percent]);

  const commit = () => {
    if (current === committed.current) return;
    committed.current = current;
    onCommit?.(current / 100);
  };

  return (
    <HStack gap="4px" onClick={(e) => e.stopPropagation()} title={label}>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={current}
        aria-label={label}
        onChange={(e) => setCurrent(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        style={{ width }}
      />
      <Text fontSize="10px" minWidth="30px" textAlign="right" color="fg.muted">{current}%</Text>
    </HStack>
  );
};

export default VolumeSlider;
