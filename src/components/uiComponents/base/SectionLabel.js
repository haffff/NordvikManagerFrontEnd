import * as React from "react";
import { Text } from "@chakra-ui/react";
import themeColors from "../../../helpers/themeColors";

// Small uppercase heading over a group of controls, as in the chat's dice roller and search.
export const SectionLabel = ({ children }) => (
  <Text fontSize="2xs" textTransform="uppercase" letterSpacing="0.06em" color={themeColors.textMuted} mb={1}>
    {children}
  </Text>
);

export default SectionLabel;
