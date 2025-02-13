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
import { useState } from "react";

export const DColorPicker = ({ initColor, onValueChange }) => {
  const [color, setColor] = useState(initColor || "rgb(0,0,0)");

  return (
    <ColorPickerRoot
      defaultValue={parseColor(color)}
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
          <ColorPickerValueText minW="160px" />
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
