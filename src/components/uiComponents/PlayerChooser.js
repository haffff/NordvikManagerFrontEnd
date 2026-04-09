import * as React from "react";
import { Box, Button, Flex, Icon, Text } from "@chakra-ui/react";
import { FaChevronDown, FaChevronUp, FaMinus } from "react-icons/fa";
import ClientMediator from "../../ClientMediator";
import DListItem from "./base/List/DListItem";
import DListItemsButtonContainer from "./base/List/DListItemsButtonContainer";
import DListItemButton from "./base/List/ListItemDetails/DListItemButton";
import PlayerAvatar from "./PlayerAvatar";
import Subscribable from "./base/Subscribable";

// ─── SelectedChip — one chosen player row ─────────────────────────────────────

const SelectedChip = React.memo(({ player, isDisabled, onRemove }) => (
  <DListItem withHover width="100%">
    <Flex align="center" gap={2} px={1} flex="1" minW={0}>
      <PlayerAvatar player={player} />
      <Text fontSize="xs" noOfLines={1} flex="1" minW={0} ml={1}>{player.name}</Text>
    </Flex>
    <DListItemsButtonContainer>
      <DListItemButton
        isDisabled={isDisabled}
        icon={FaMinus}
        color="red"
        onClick={() => onRemove(player.id)}
      />
    </DListItemsButtonContainer>
  </DListItem>
));

// ─── Main component ───────────────────────────────────────────────────────────

export const PlayerChooser = ({
  onSelect,
  multipleSelection,
  selectedPlayers,   // array of player IDs
  isDisabled,
}) => {
  const [players, setPlayers]       = React.useState([]);
  const [selected, setSelected]     = React.useState([]);   // full player objects
  const [showPicker, setShowPicker] = React.useState(false);

  // Stable ref so callbacks always see the latest selected list
  const selectedRef = React.useRef(selected);
  selectedRef.current = selected;

  // ── load ─────────────────────────────────────────────────────────────────

  const selectedPlayersRef = React.useRef(selectedPlayers);
  React.useLayoutEffect(() => { selectedPlayersRef.current = selectedPlayers; });
  const loadData = React.useCallback(() => {
    const all = ClientMediator.sendCommand("Game", "GetPlayers", {}) ?? [];
    setPlayers(all);
    // Preserve the current live selection — only re-anchor objects to the
    // fresh player list so references stay valid. Do NOT reset to prop IDs
    // here, otherwise every WS player event would blow away the user's clicks.
    setSelected((prev) => {
      const prevIds = prev.map((p) => p.id);
      return all.filter((p) => prevIds.includes(p.id));
    });
  }, []);

  // Initial mount: seed selection from the incoming prop
  React.useEffect(() => {
    const all = ClientMediator.sendCommand("Game", "GetPlayers", {}) ?? [];
    setPlayers(all);
    const ids = selectedPlayersRef.current ?? [];
    setSelected(all.filter((p) => ids.includes(p.id)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-derive when the prop changes (parent explicitly updates the selection)
  React.useEffect(() => {
    setPlayers((all) => {
      const ids = selectedPlayers ?? [];
      setSelected(all.filter((p) => ids.includes(p.id)));
      return all;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayers]);

  // ── commit helpers ────────────────────────────────────────────────────────
  const commitSelection = React.useCallback((next) => {
    setSelected(next);
    // Always call onSelect with an array of IDs — callers destructure as needed
    onSelect?.(next.map((p) => p.id));
  }, [onSelect]);

  const handleRemove = React.useCallback((id) => {
    commitSelection(selectedRef.current.filter((p) => p.id !== id));
  }, [commitSelection]);

  // ── immediate toggle on row click ─────────────────────────────────────────

  const handleToggle = React.useCallback((player) => {
    const already = selectedRef.current.find((p) => p.id === player.id);
    if (multipleSelection) {
      const next = already
        ? selectedRef.current.filter((p) => p.id !== player.id)
        : [...selectedRef.current, player];
      commitSelection(next);
    } else {
      commitSelection(already ? [] : [player]);
      if (!already) setShowPicker(false);
    }
  }, [multipleSelection, commitSelection]);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <Box width="100%">
      <Subscribable onMessage={loadData} commandPrefix="player" />

      {/* Selected items */}
      {selected.length > 0 && (
        <Box mb={2}>
          {selected.map((player) => (
            <SelectedChip
              key={player.id}
              player={player}
              isDisabled={isDisabled}
              onRemove={handleRemove}
            />
          ))}
        </Box>
      )}

      {/* Toggle button */}
      <Button
        size="xs"
        variant="outline"
        width="100%"
        disabled={isDisabled}
        onClick={() => setShowPicker((v) => !v)}
      >
        <Icon as={showPicker ? FaChevronUp : FaChevronDown} mr={1} />
        {showPicker
          ? "Close"
          : (selected.length > 0
              ? "Change"
              : `Select Player${multipleSelection ? "s" : ""}`)}
      </Button>

      {/* Picker panel */}
      {showPicker && (
        <Box
          mt={2}
          border="1px solid"
          borderColor="whiteAlpha.200"
          borderRadius="md"
          bg="var(--nordvik-background-color, #1a1a2e)"
          overflow="hidden"
          w="100%"
        >
          <Box maxH="260px" overflowY="auto" px={1} py={1}>
            {players.length === 0 ? (
              <Text fontSize="xs" color="gray.500" textAlign="center" py={3}>
                No players available
              </Text>
            ) : (
              players.map((player) => {
                const isSelected = !!selected.find((p) => p.id === player.id);
                return (
                  <Flex
                    key={player.id}
                    align="center"
                    gap={2}
                    px={2}
                    py="4px"
                    borderRadius="sm"
                    bg={isSelected ? "var(--nordvik-selection-color, #2d3a5a)" : undefined}
                    _hover={{ bg: "whiteAlpha.100" }}
                    transition="background 0.1s"
                    cursor="pointer"
                    onClick={() => handleToggle(player)}
                  >
                    {/* Checkbox (multi) or radio (single) indicator */}
                    <Flex
                      flexShrink={0}
                      align="center"
                      justify="center"
                      w="14px" h="14px"
                      borderRadius={multipleSelection ? "3px" : "50%"}
                      border="1.5px solid"
                      borderColor={isSelected ? "blue.400" : "whiteAlpha.400"}
                      bg={isSelected ? "blue.500" : "transparent"}
                      transition="all 0.1s"
                    >
                      {isSelected && (
                        <Box
                          w={multipleSelection ? "8px" : "6px"}
                          h={multipleSelection ? "8px" : "6px"}
                          borderRadius={multipleSelection ? "1px" : "50%"}
                          bg="white"
                        />
                      )}
                    </Flex>
                    <PlayerAvatar player={player} />
                    <Text fontSize="xs" noOfLines={1} ml={1}>{player.name}</Text>
                  </Flex>
                );
              })
            )}
          </Box>

          {/* Close row */}
          <Flex
            px={2} py={2}
            borderTop="1px solid"
            borderColor="whiteAlpha.200"
            justify="flex-end"
          >
            <Button size="xs" variant="ghost" onClick={() => setShowPicker(false)}>
              Close
            </Button>
          </Flex>
        </Box>
      )}
    </Box>
  );
};

export default PlayerChooser;
