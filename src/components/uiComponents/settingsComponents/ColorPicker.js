import { HStack, parseColor } from "@chakra-ui/react";
import {
  ColorPickerArea,
  ColorPickerContent,
  ColorPickerControl,
  ColorPickerEyeDropper,
  ColorPickerLabel,
  ColorPickerRoot,
  ColorPickerSliders,
  ColorPickerTrigger,
  ColorPickerValueSwatch,
  ColorPickerValueText,
} from "../../ui/color-picker";
import React, { useState } from "react";

// An unset colour shows as fully transparent. Picking a colour from there kept alpha at
// 0, so the pick stayed invisible: make it opaque unless the alpha itself is being set.
export function withVisibleAlpha(previous, next) {
  if (previous.getChannelValue("alpha") === 0 && next.getChannelValue("alpha") === 0) {
    return next.withChannelValue("alpha", 1);
  }
  return next;
}

export const DColorPicker = ({ initColor, onValueChange, minimal }) => {
  const [color, setColor] = useState(initColor || "rgba(0,0,0,0)");

  React.useEffect(() => {
    if (initColor) {
      setColor(initColor || "rgba(0,0,0,0)"); // Default to transparent if no color is provided
    }
  }, [initColor]);

  return (
    <ColorPickerRoot
      value={parseColor(color)}
      onValueChange={({ value }) => {
        const valueAsString = withVisibleAlpha(parseColor(color), value).toString("rgba");
        setColor(valueAsString);
        if (onValueChange) {
          onValueChange(valueAsString);
        }
      }}
      maxW="200px"
    >
      <ColorPickerControl>
        <ColorPickerTrigger px="2">
          <ColorPickerValueSwatch boxSize="6" />
          {!minimal && <ColorPickerValueText minW="160px" />}
        </ColorPickerTrigger>
      </ColorPickerControl>
      <ColorPickerContent zIndex={9999}>
        <ColorPickerArea />
        <HStack>
          <ColorPickerEyeDropper />
          <ColorPickerSliders />
          <ColorPickerValueSwatch />
        </HStack>
      </ColorPickerContent>
    </ColorPickerRoot>
  );
};
