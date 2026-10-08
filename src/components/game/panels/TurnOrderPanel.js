import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import { Box, Button, Flex, HStack, IconButton, Input, Text } from "@chakra-ui/react";
import { FaChessPawn, FaEye, FaEyeSlash, FaFlag, FaGripVertical, FaPlay, FaSortAmountDown, FaStepBackward, FaStepForward, FaTimes, FaUndo } from "react-icons/fa";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import ClientMediator from "../../../ClientMediator";
import themeColors from "../../../helpers/themeColors";
import { TurnOrderService } from "../turnOrder/TurnOrderService";
import { useTurnOrder } from "../turnOrder/turnOrderStore";

const showOnMap = async (elementId) => {
  const battleMapId = await ClientMediator.sendCommandAsync("Game", "GetActiveBattleMapId");
  if (battleMapId) ClientMediator.sendCommand("BattleMap", "FocusElement", { contextId: battleMapId, elementId });
};

// Initiative typed by the GM, saved on blur (or Enter).
const InitiativeField = ({ entry }) => {
  const [value, setValue] = React.useState(entry.initiative ?? "");
  React.useEffect(() => setValue(entry.initiative ?? ""), [entry.initiative]);
  return (
    <Input
      size="xs"
      width="52px"
      textAlign="center"
      aria-label={`Initiative of ${entry.name}`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      onBlur={() => {
        if (String(value) !== String(entry.initiative ?? "")) TurnOrderService.SetInitiative({ entryId: entry.id, initiative: value });
      }}
    />
  );
};

/**
 * The turn order of the map on screen (Views → Turn order). Everyone sees it; the GM
 * (canEdit) changes it, and a player ends their own token's turn (canEndTurn).
 */
export const TurnOrderPanel = () => {
  const ctx = Dockable.useContentContext();
  ctx.setTitle("Turn order");

  const state = useTurnOrder();
  const [newEntry, setNewEntry] = React.useState("");
  const dragged = React.useRef(null);

  if (!state) {
    return (
      <BasePanel>
        <Text padding="8px" color={themeColors.textMuted}>Open a battle map to see its turn order.</Text>
      </BasePanel>
    );
  }

  const { canEdit, canEndTurn } = state;
  const entries = state.entries ?? [];

  const onDrop = (targetId) => {
    const from = dragged.current;
    dragged.current = null;
    if (!from || from === targetId) return;
    const ids = entries.map((e) => e.id).filter((id) => id !== from);
    ids.splice(ids.indexOf(targetId), 0, from);
    TurnOrderService.Reorder({ entryIds: ids });
  };

  const addEntry = () => {
    const name = newEntry.trim();
    if (!name) return;
    TurnOrderService.Add({ name });
    setNewEntry("");
  };

  return (
    <BasePanel>
      <Flex direction="column" gap="6px" padding="6px" height="100%">
        <HStack justify="space-between">
          <Text className="nm_label" fontWeight="bold">Round {state.round}</Text>
          <HStack gap="2px">
            {canEdit && (
              <>
                <IconButton size="xs" variant="ghost" aria-label="Previous turn" title="Previous turn" onClick={() => TurnOrderService.Previous()}><FaStepBackward /></IconButton>
                <IconButton size="xs" variant="ghost" aria-label="Next turn" title="Next turn" onClick={() => TurnOrderService.Next()}><FaStepForward /></IconButton>
                <IconButton size="xs" variant="ghost" aria-label="Sort by initiative" title="Sort by initiative" onClick={() => TurnOrderService.Sort()}><FaSortAmountDown /></IconButton>
                <IconButton size="xs" variant="ghost" aria-label="Restart at round 1" title="Restart at round 1" onClick={() => TurnOrderService.Reset({ clear: false })}><FaUndo /></IconButton>
              </>
            )}
            {!canEdit && canEndTurn && (
              <Button size="xs" colorPalette="green" variant="outline" onClick={() => TurnOrderService.EndTurn()}><FaFlag /> End my turn</Button>
            )}
          </HStack>
        </HStack>

        <Box className="nm_list" flex="1" overflowY="auto">
          {state.currentHidden && (
            <Flex className="nm_dlistitem" aria-label="A hidden turn" aria-current="true" padding="4px 8px" borderRadius="4px"
              background={themeColors.chatOwn} color={themeColors.textMuted}>
              …
            </Flex>
          )}
          {entries.map((entry) => {
            const current = entry.id === state.currentEntryId;
            return (
              <Flex
                key={entry.id}
                data-entry
                data-hidden={entry.hidden ? "true" : "false"}
                aria-current={current ? "true" : "false"}
                className="nm_dlistitem"
                align="center"
                gap="6px"
                padding="4px 6px"
                marginBottom="2px"
                borderRadius="4px"
                borderLeft="3px solid"
                borderColor={current ? themeColors.accent : "transparent"}
                background={current ? themeColors.chatOwn : themeColors.surface}
                opacity={entry.hidden ? 0.6 : 1}
                cursor={entry.elementId ? "pointer" : "default"}
                onDragOver={(e) => { if (canEdit) e.preventDefault(); }}
                onDrop={() => onDrop(entry.id)}
                onClick={() => entry.elementId && showOnMap(entry.elementId)}
              >
                {/* Dragged by this grip only, so the initiative field and buttons stay usable. */}
                {canEdit && (
                  <Box
                    data-drag-handle
                    draggable
                    aria-label={`Drag ${entry.name}`}
                    title="Drag to move"
                    color={themeColors.textSubtle}
                    cursor="grab"
                    onClick={(e) => e.stopPropagation()}
                    onDragStart={(e) => {
                      dragged.current = entry.id;
                      const rowEl = e.currentTarget.closest("[data-entry]");
                      try { if (rowEl) e.dataTransfer?.setDragImage?.(rowEl, 12, 12); } catch { /* jsdom */ }
                    }}
                  >
                    <FaGripVertical />
                  </Box>
                )}
                <Box color={themeColors.textMuted}>{entry.elementId ? <FaChessPawn /> : <FaFlag />}</Box>
                <Text flex="1" truncate>{entry.name}</Text>
                {canEdit ? <InitiativeField entry={entry} /> : <Text minWidth="24px" textAlign="right">{entry.initiative ?? ""}</Text>}
                {canEdit && (
                  <HStack gap="0" onClick={(e) => e.stopPropagation()}>
                    {!current && (
                      <IconButton size="2xs" variant="ghost" aria-label={`Make it ${entry.name}'s turn`} title="Make it this entry's turn"
                        onClick={() => TurnOrderService.GoTo({ entryId: entry.id })}><FaPlay /></IconButton>
                    )}
                    <IconButton size="2xs" variant="ghost"
                      aria-label={entry.hidden ? `Show ${entry.name} to players` : `Hide ${entry.name} from players`}
                      title={entry.hidden ? "Hidden from players" : "Visible to players"}
                      onClick={() => TurnOrderService.SetHidden({ entryId: entry.id, hidden: !entry.hidden })}>
                      {entry.hidden ? <FaEyeSlash /> : <FaEye />}
                    </IconButton>
                    <IconButton size="2xs" variant="ghost" aria-label={`Remove ${entry.name}`} title="Remove"
                      onClick={() => TurnOrderService.Remove({ entryIds: [entry.id] })}><FaTimes /></IconButton>
                  </HStack>
                )}
              </Flex>
            );
          })}
          {entries.length === 0 && !state.currentHidden && (
            <Text padding="6px" fontSize="sm" color={themeColors.textMuted}>
              {canEdit ? "Right-click tokens on the map → Add to turn order, or add an entry below." : "No turn order yet."}
            </Text>
          )}
        </Box>

        {canEdit && (
          <HStack>
            <Input size="xs" aria-label="New entry" placeholder="Add an entry (e.g. Lair action)" value={newEntry}
              onChange={(e) => setNewEntry(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addEntry(); }} />
            <Button size="xs" variant="outline" onClick={addEntry}>Add</Button>
          </HStack>
        )}
      </Flex>
    </BasePanel>
  );
};

export default TurnOrderPanel;
