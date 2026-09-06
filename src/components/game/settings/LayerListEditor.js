import * as React from "react";
import { Badge, Box, Button, HStack, Icon, Input, NativeSelect, Text } from "@chakra-ui/react";
import { IoMdAdd } from "react-icons/io";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import { useCustomLayers } from "../../uiComponents/hooks/useCustomLayers";

// One row for an existing custom layer: name (rename on blur), move up/down, remove.
const LayerRow = React.memo(({ row, propertyId, canMoveUp, canMoveDown, onRemove, onMove }) => {
  const [name, setName] = React.useState(row.name);
  React.useEffect(() => { setName(row.name); }, [row.name]);

  const commitRename = () => {
    if (name.trim() && name !== row.name) {
      WebSocketManagerInstance.Send(
        CommandFactory.CreatePropertyListItemUpdateCommand(propertyId, row.id, { name: name.trim() })
      );
    } else {
      setName(row.name);
    }
  };

  return (
    <HStack gap={1} py="2px">
      <Button size="2xs" variant="ghost" disabled={!canMoveUp} onClick={() => onMove(row.id, 1)} aria-label="Move layer up">▲</Button>
      <Button size="2xs" variant="ghost" disabled={!canMoveDown} onClick={() => onMove(row.id, -1)} aria-label="Move layer down">▼</Button>
      <Input
        size="xs"
        variant="flushed"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      />
      <Button
        size="2xs"
        variant="ghost"
        color="red.400"
        onClick={() => onRemove(row.id)}
        aria-label={`Remove layer ${row.name}`}
      >
        ✕
      </Button>
    </HStack>
  );
});

// A Grid/Token/Background row — shown so the GM can see where custom layers sit
// relative to them, but never editable/movable/removable.
const ReservedRow = React.memo(({ row }) => (
  <HStack gap={2} py="2px" pl={1}>
    <Badge size="xs" variant="subtle" colorPalette="gray">Reserved</Badge>
    <Text fontSize="xs" color="gray.400">{row.name}</Text>
  </HStack>
));

export const LayerListEditor = ({ gameId }) => {
  const { propertyId, layers } = useCustomLayers(gameId);
  const [newName, setNewName] = React.useState("");
  const [insertAfterLayerId, setInsertAfterLayerId] = React.useState(null);

  // layers is topmost-first; default the picker to the current topmost row,
  // i.e. "insert above everything" — the old part-1 default behavior.
  const effectiveInsertAfter = insertAfterLayerId ?? layers[0]?.layerId ?? null;

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    WebSocketManagerInstance.Send(CommandFactory.CreateCustomLayerAddCommand(name, effectiveInsertAfter));
    setNewName("");
  };

  const handleRemove = (itemId) => {
    WebSocketManagerInstance.Send(CommandFactory.CreateCustomLayerRemoveCommand(itemId));
  };

  const handleMove = (itemId, direction) => {
    WebSocketManagerInstance.Send(CommandFactory.CreateCustomLayerMoveCommand(itemId, direction));
  };

  return (
    <Box>
      {layers.map((row, idx) =>
        row.kind === "custom" ? (
          <LayerRow
            key={row.key}
            row={row}
            propertyId={propertyId}
            canMoveUp={idx > 0}
            canMoveDown={idx < layers.length - 1}
            onRemove={handleRemove}
            onMove={handleMove}
          />
        ) : (
          <ReservedRow key={row.key} row={row} />
        )
      )}

      <HStack gap={2} mt={2}>
        <Input
          size="xs"
          variant="flushed"
          placeholder="New layer name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
        />
        <NativeSelect.Root size="xs" width="180px">
          <NativeSelect.Field
            value={effectiveInsertAfter !== null ? String(effectiveInsertAfter) : ""}
            onChange={(e) => setInsertAfterLayerId(Number(e.target.value))}
          >
            {layers.map((l) => (
              <option key={l.key} value={l.layerId}>Above: {l.name}</option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Button size="2xs" variant="outline" onClick={handleAdd}>
          <Icon as={IoMdAdd} mr={1} /> Add layer
        </Button>
      </HStack>

      <Text fontSize="2xs" color="gray.500" mt={1}>
        Removing a layer moves any elements on it back to the Map layer.
      </Text>
    </Box>
  );
};

export default LayerListEditor;
