import { HStack, Text, parseColor } from "@chakra-ui/react";
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

// Where an unset colour field opens: opaque, so picking a colour just works.
export const DEFAULT_COLOR = "rgba(0,0,0,1)";

export const DColorPicker = ({ initColor, onValueChange, minimal }) => {
  const [color, setColor] = useState(initColor || DEFAULT_COLOR);
  // Unset until a colour is given or picked — shown as "Not set", not as the default.
  const [isSet, setIsSet] = useState(!!initColor);

  React.useEffect(() => {
    if (initColor) {
      setColor(initColor);
      setIsSet(true);
    }
  }, [initColor]);

  return (
    <ColorPickerRoot
      value={parseColor(color)}
      onValueChange={({ value }) => {
        const valueAsString = withVisibleAlpha(parseColor(color), value).toString("rgba");
        setColor(valueAsString);
        setIsSet(true);
        if (onValueChange) {
          onValueChange(valueAsString);
        }
      }}
      maxW="200px"
    >
      <ColorPickerControl>
        <ColorPickerTrigger px="2">
          <ColorPickerValueSwatch boxSize="6" />
          {!minimal && (isSet
            ? <ColorPickerValueText minW="160px" />
            : <Text minW="160px" color="fg.muted">Not set</Text>)}
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
