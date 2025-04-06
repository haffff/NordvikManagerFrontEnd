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
      onValueChange={({ valueAsString }) => {
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
