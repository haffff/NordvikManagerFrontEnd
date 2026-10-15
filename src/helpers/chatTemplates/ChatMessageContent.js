import * as React from "react";
import { Text } from "@chakra-ui/react";
import ChatMessageParser from "../ChatMessageParser";
import { ErrorBoundary } from "../../components/uiComponents/base/ErrorBoundary";
import { asText } from "./asText";
import themeColors from "../themeColors";

const parser = new ChatMessageParser();

// Only the server marks a message as a template (isTemplate: rolls, Html messages,
// action steps). Everything else is what a player typed — shown as text even when
// it's JSON that looks like a template, so nobody can post a fake roll.
const Content = ({ item }) => {
  if (!item?.isTemplate) return asText(item?.data) ?? null;
  const parsed = parser.ParseMessage(item.data);
  return typeof parsed === "string" ? parsed : parsed ?? null;
};

const Unreadable = () => (
  <Text as="span" fontSize="12px" fontStyle="italic" color={themeColors.textMuted}>
    This message could not be displayed.
  </Text>
);

/** One chat message's content; a template that fails to render stays on its own line. */
export const ChatMessageContent = ({ item }) => (
  <ErrorBoundary name="chat message" resetKey={item?.data} fallback={() => <Unreadable />}>
    <Content item={item} />
  </ErrorBoundary>
);

export default ChatMessageContent;
