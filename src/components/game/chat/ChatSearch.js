import * as React from "react";
import { Box, Button, Input, NativeSelect, Text } from "@chakra-ui/react";
import themeColors from "../../../helpers/themeColors";
import SectionLabel from "../../uiComponents/base/SectionLabel";

// Chat search, laid out like the dice roller next to it (DiceRoller.js): labelled
// sections, a summary box, one full-width action. The search stays on when the popover
// closes — the chat's search button shows that it's filtered.
export const ChatSearch = ({ filter, setFilter, from, setFrom, players = [] }) => {
  const sender = players.find((p) => p.id === from);
  const active = !!(filter || from);

  return (
    <Box
      className="nm_chatSearch"
      p={3}
      minW="260px"
      color="var(--nordvik-text-color)"
      // Keep typing in the search away from the game's keyboard bindings.
      onKeyDown={(e) => e.stopPropagation()}
    >
      <SectionLabel>Contains</SectionLabel>
      <Input
        aria-label="Contains"
        size="xs"
        mb={3}
        placeholder="Text in the message…"
        value={filter ?? ""}
        onChange={(e) => setFilter(e.target.value || undefined)}
        autoFocus
      />

      <SectionLabel>From</SectionLabel>
      <NativeSelect.Root size="xs" mb={3}>
        <NativeSelect.Field aria-label="From" value={from ?? ""} onChange={(e) => setFrom(e.target.value || undefined)}>
          <option value="">Anyone</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>

      <Box
        className="nm_chatSearchPreview"
        bg={themeColors.surfaceSunken}
        border="1px solid"
        borderColor={themeColors.border}
        borderRadius="6px"
        px={2}
        py={1}
        mb={2}
      >
        <Text data-testid="chat-search-summary" fontSize="sm">
          {active
            ? `Messages${sender ? ` from ${sender.name}` : ""}${filter ? ` containing "${filter}"` : ""}`
            : "All messages"}
        </Text>
        <Text fontSize="2xs" color={themeColors.textMuted}>
          {active ? "Stays on after closing — clear it to see the whole chat." : "Type or pick a sender to search."}
        </Text>
      </Box>

      <Button
        width="100%"
        size="sm"
        disabled={!active}
        onClick={() => {
          setFilter(undefined);
          setFrom(undefined);
        }}
      >
        Clear search
      </Button>
    </Box>
  );
};

export default ChatSearch;
