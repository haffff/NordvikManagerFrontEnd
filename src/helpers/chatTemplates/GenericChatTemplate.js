import * as React from "react";
import { Box, Text } from "@chakra-ui/react";
import themeColors from "../themeColors";

// ── Design tokens (kept local so the file is self-contained) ──────────────────
const BG_CARD    = themeColors.surfaceRaised;
const BORDER_CLR = themeColors.border;
const CLR_TITLE  = themeColors.text;
const CLR_MUTED  = themeColors.textMuted;

// Renders the backend's default/"Generic" chat template (SendChat with Template
// "Text", or any Template value it doesn't recognise) — a plain title + message
// card. This is what dnd5e.DisplaySpellDescription (and any other plain
// informational chat post) renders as; only "Roll" had a renderer before this.
export const GenericChatTemplate = ({ object }) => {
  if (!object?.title && !object?.message) return null;

  const { title, message } = object;
  const chatColor       = object.color;
  const chatBorderColor = object.borderColor;

  return (
    <Box
      borderRadius="6px"
      borderWidth="1px"
      borderColor={chatBorderColor || BORDER_CLR}
      bg={chatColor || BG_CARD}
      px="10px"
      py="8px"
      my="2px"
      maxW="100%"
    >
      {title && (
        <Text fontSize="12px" fontWeight="bold" color={CLR_TITLE} mb="4px">
          {title}
        </Text>
      )}
      {message && (
        <Text fontSize="12px" color={CLR_MUTED} whiteSpace="pre-wrap">
          {message}
        </Text>
      )}
    </Box>
  );
};
