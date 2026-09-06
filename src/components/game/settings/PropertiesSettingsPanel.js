import * as React from "react";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import Subscribable from "../../uiComponents/base/Subscribable";
import { ActiveWebHelper as WebHelper } from "../../../helpers/transport";
import { IoMdAdd } from "react-icons/io";
import { FaLock, FaLockOpen, FaChevronDown, FaChevronRight } from "react-icons/fa";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Input,
  Table,
  Text,
} from "@chakra-ui/react";
import { Tooltip } from "../../ui/tooltip";
import { SearchInput } from "../../uiComponents/SearchInput";
import { DDataTable } from "../../uiComponents/DDataTable";
import { toaster } from "../../ui/toaster";

// ─── Row colour helper ────────────────────────────────────────────────────────

const rowBg = (property) => {
  if (property.toDel) return "rgba(180,30,30,0.25)";
  if (property.toAdd) return "rgba(30,140,30,0.25)";
  if (property.toEdit) return "rgba(80,80,80,0.35)";
  return undefined;
};

// ─── List-value detection ──────────────────────────────────────────────────────
// A "list" property is just a plain property whose Value happens to be a JSON
// array of {id, fields} rows (see PropertyList command handlers on the backend —
// there's no dedicated schema flag, the shape itself is the signal).

export const parseListValue = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("[")) return null;
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  if (parsed.length > 0) {
    const first = parsed[0];
    if (typeof first !== "object" || first === null || !("id" in first) || !("fields" in first)) return null;
  }
  return parsed;
};

// ─── Single field's value input ─────────────────────────────────────────────────
// Controlled (not defaultValue) and resynced from `value` on every render, so an
// external change (another client editing the same row, or our own null-delete
// round-tripping) actually reaches an already-mounted input instead of the commit
// comparing against a stale closure and silently re-sending the old value.

const ListItemFieldInput = ({ value, onCommit }) => {
  const [local, setLocal] = React.useState(value ?? "");
  React.useEffect(() => { setLocal(value ?? ""); }, [value]);

  return (
    <Input
      size="2xs"
      variant="flushed"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== (value ?? "")) onCommit(local);
      }}
    />
  );
};

// ─── Single list-item's fields ─────────────────────────────────────────────────

const ListItemFields = React.memo(({ item, onFieldCommit, onFieldRemove }) => {
  const [newKey, setNewKey] = React.useState("");
  const [newValue, setNewValue] = React.useState("");
  const fieldEntries = Object.entries(item.fields ?? {}).filter(([, v]) => v !== null && v !== undefined);

  const commitNewField = () => {
    if (!newKey.trim()) return;
    onFieldCommit(newKey.trim(), newValue);
    setNewKey("");
    setNewValue("");
  };

  return (
    <Box pl={4} py={1}>
      {fieldEntries.map(([key, value]) => (
        <HStack key={key} gap={2} py="2px">
          <Text fontSize="xs" color="gray.400" minW="90px" noOfLines={1}>{key}</Text>
          <ListItemFieldInput value={value} onCommit={(v) => onFieldCommit(key, v)} />
          <Button size="2xs" variant="ghost" color="red.400" onClick={() => onFieldRemove(key)} aria-label={`Remove field ${key}`}>
            ✕
          </Button>
        </HStack>
      ))}
      <HStack gap={2} py="2px">
        <Input
          size="2xs"
          variant="flushed"
          placeholder="field name"
          minW="90px"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
        />
        <Input
          size="2xs"
          variant="flushed"
          placeholder="value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commitNewField(); }}
        />
        <Button size="2xs" variant="ghost" onClick={commitNewField} aria-label="Add field">
          <Icon as={IoMdAdd} />
        </Button>
      </HStack>
    </Box>
  );
});

// ─── List-item editor — rows inside a list-shaped property ─────────────────────

const PropertyListItemsEditor = ({ propertyId, items }) => {
  const fireAdd = () => {
    WebSocketManagerInstance.Send(CommandFactory.CreatePropertyListItemAddCommand(propertyId, {}));
  };

  const fireRemove = (itemId) => {
    WebSocketManagerInstance.Send(CommandFactory.CreatePropertyListItemRemoveCommand(propertyId, itemId));
  };

  const fireFieldCommit = (itemId, key, value) => {
    WebSocketManagerInstance.Send(CommandFactory.CreatePropertyListItemUpdateCommand(propertyId, itemId, { [key]: value }));
  };

  const fireFieldRemove = (itemId, key) => {
    WebSocketManagerInstance.Send(CommandFactory.CreatePropertyListItemUpdateCommand(propertyId, itemId, { [key]: null }));
  };

  const fireMove = (itemId, direction) => {
    const ids = items.map((i) => i.id);
    const idx = ids.indexOf(itemId);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= ids.length) return;
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    WebSocketManagerInstance.Send(CommandFactory.CreatePropertyListReorderCommand(propertyId, ids));
  };

  return (
    <Box borderLeft="2px solid" borderColor="whiteAlpha.200" ml={2}>
      {items.length === 0 && (
        <Text fontSize="xs" color="gray.500" pl={4} py={1}>No rows yet.</Text>
      )}
      {items.map((item, idx) => (
        <Box key={item.id} borderBottom="1px solid" borderColor="whiteAlpha.100" pb={1} mb={1}>
          <HStack pl={2} gap={1}>
            <Button size="2xs" variant="ghost" disabled={idx === 0} onClick={() => fireMove(item.id, -1)} aria-label="Move up">▲</Button>
            <Button size="2xs" variant="ghost" disabled={idx === items.length - 1} onClick={() => fireMove(item.id, 1)} aria-label="Move down">▼</Button>
            <Text fontSize="2xs" color="gray.500" flex={1}>Row {idx + 1}</Text>
            <Button size="2xs" variant="ghost" color="red.400" onClick={() => fireRemove(item.id)} aria-label="Remove row">✕</Button>
          </HStack>
          <ListItemFields
            item={item}
            onFieldCommit={(key, value) => fireFieldCommit(item.id, key, value)}
            onFieldRemove={(key) => fireFieldRemove(item.id, key)}
          />
        </Box>
      ))}
      <Button size="2xs" variant="ghost" ml={2} mt={1} onClick={fireAdd}>
        <Icon as={IoMdAdd} mr={1} /> Add row
      </Button>
    </Box>
  );
};

// ─── Single property row ──────────────────────────────────────────────────────

const PropertyRow = React.memo(({ property, onNameChange, onValueChange, onProtectedToggle, onDelete, expanded, onToggleExpand }) => {
  const bg = rowBg(property);
  const idOrTempId = property.id ?? property._tempId;
  const isProtected = !!property.isProtected;
  const listItems = !isProtected ? parseListValue(property.value) : null;
  // Item-level ops need a real, already-saved property id — a pending (toAdd)
  // list property must be saved first before its rows can be edited.
  const isSavedList = listItems !== null && !!property.id && !property.toAdd;

  return (
    <>
      <Table.Row style={{ backgroundColor: bg, transition: "background-color 0.15s" }}>
        {/* Name */}
        <Table.Cell>
          <Input
            size="xs"
            variant="flushed"
            value={property.name ?? ""}
            disabled={property.toDel}
            onChange={(e) => onNameChange(idOrTempId, e.target.value)}
          />
        </Table.Cell>

        {/* Value — masked when protected, a badge + expand toggle when list-shaped */}
        <Table.Cell>
          {isProtected ? (
            <Text fontSize="xs" color="gray.500" letterSpacing="0.15em" userSelect="none">
              ••••••
            </Text>
          ) : isSavedList ? (
            <HStack
              gap={1}
              cursor="pointer"
              userSelect="none"
              onClick={() => onToggleExpand(idOrTempId)}
            >
              <Box color="gray.500" fontSize="10px">
                {expanded ? <FaChevronDown /> : <FaChevronRight />}
              </Box>
              <Badge size="xs" variant="subtle" colorPalette="purple">
                List · {listItems.length} row{listItems.length === 1 ? "" : "s"}
              </Badge>
            </HStack>
          ) : (
            <Input
              size="xs"
              variant="flushed"
              value={property.value ?? ""}
              disabled={property.toDel}
              onChange={(e) => onValueChange(idOrTempId, e.target.value)}
            />
          )}
        </Table.Cell>

        {/* Protected toggle */}
        <Table.Cell width="36px" textAlign="center">
          <Tooltip content={isProtected ? "Protected — value stored on server only" : "Click to protect"}>
            <Button
              size="xs"
              variant="ghost"
              disabled={property.toDel}
              color={isProtected ? "yellow.400" : "gray.500"}
              onClick={() => onProtectedToggle(idOrTempId, !isProtected)}
              aria-label={isProtected ? "Unprotect property" : "Protect property"}
            >
              <Icon as={isProtected ? FaLock : FaLockOpen} />
            </Button>
          </Tooltip>
        </Table.Cell>

        {/* Delete / undo */}
        <Table.Cell width="36px" textAlign="center">
          <Tooltip content={property.toDel ? "Undo delete" : "Delete property"}>
            <Button
              size="xs"
              variant="ghost"
              color={property.toDel ? "orange.400" : "red.400"}
              onClick={() => onDelete(idOrTempId)}
              aria-label={property.toDel ? "Undo delete" : "Delete property"}
            >
              {property.toDel ? "↩" : "✕"}
            </Button>
          </Tooltip>
        </Table.Cell>
      </Table.Row>

      {isSavedList && expanded && (
        <Table.Row>
          <Table.Cell colSpan={4} py={1}>
            <PropertyListItemsEditor propertyId={property.id} items={listItems} />
          </Table.Cell>
        </Table.Row>
      )}
    </>
  );
});

// ─── Main panel ───────────────────────────────────────────────────────────────

export const PropertiesSettingsPanel = ({ dto, type, initProperties }) => {
  const [properties, setProperties] = React.useState(initProperties || []);
  const [originalProperties, setOriginalProperties] = React.useState(initProperties || []);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [expandedIds, setExpandedIds] = React.useState(() => new Set());
  const COUNT = 10;

  const handleToggleExpand = React.useCallback((idOrTempId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(idOrTempId)) next.delete(idOrTempId);
      else next.add(idOrTempId);
      return next;
    });
  }, []);

  const propsRef = React.useRef(properties);
  propsRef.current = properties;

  // ── initial load ────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (initProperties?.length > 0) return;
    WebHelper.get(
      "properties/QueryProperties?parentIds=" + dto.id,
      (response) => {
        setProperties(response);
        setOriginalProperties(structuredClone(response));
      },
      (error) => console.error(error)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dto.id]);

  // ── immutable helper ─────────────────────────────────────────────────────

  const updateProp = (idOrTempId, patch) =>
    setProperties((prev) =>
      prev.map((p) =>
        (p.id ?? p._tempId) === idOrTempId ? { ...p, ...patch } : p
      )
    );

  // ── handlers ────────────────────────────────────────────────────────────

  const handleNameChange = React.useCallback((idOrTempId, value) => {
    updateProp(idOrTempId, { name: value, toEdit: true });
  }, []);

  const handleValueChange = React.useCallback((idOrTempId, value) => {
    updateProp(idOrTempId, { value, toEdit: true });
  }, []);

  const handleProtectedToggle = React.useCallback((idOrTempId, value) => {
    updateProp(idOrTempId, { isProtected: value, toEdit: true });
  }, []);

  const handleDelete = React.useCallback((idOrTempId) => {
    setProperties((prev) =>
      prev.flatMap((p) => {
        if ((p.id ?? p._tempId) !== idOrTempId) return [p];
        if (p.toAdd) return [];               // new unsaved row — just remove it
        return [{ ...p, toDel: !p.toDel }];  // toggle mark on saved row
      })
    );
  }, []);

  const handleAdd = () => {
    setProperties((prev) => [
      ...prev,
      {
        _tempId: crypto.randomUUID(),
        name: "New_Property",
        value: "",
        isProtected: false,
        entityName: type,
        parentId: dto.id,
        toAdd: true,
      },
    ]);
  };

  const handleAddList = () => {
    setProperties((prev) => [
      ...prev,
      {
        _tempId: crypto.randomUUID(),
        name: "New_List",
        value: "[]",
        isProtected: false,
        entityName: type,
        parentId: dto.id,
        toAdd: true,
      },
    ]);
  };

  const handleSave = () => {
    const snapshot = [...propsRef.current];
    snapshot.forEach((p) => {
      if (p.toDel && !p.toAdd) {
        WebSocketManagerInstance.Send(CommandFactory.CreatePropertyRemoveCommand(p.id));
      } else if (p.toAdd) {
        const { _tempId, toAdd, toEdit, ...payload } = p;
        WebSocketManagerInstance.Send(CommandFactory.CreatePropertyAddCommand(payload));
      } else if (p.toEdit) {
        const { toEdit, ...payload } = p;
        WebSocketManagerInstance.Send(CommandFactory.CreatePropertyUpdateCommand(payload));
      }
    });
  };

  const handleReset = () => {
    setProperties(structuredClone(originalProperties));
    setPage(1);
  };

  // ── websocket ───────────────────────────────────────────────────────────

  const handleMessage = (event) => {
    // List-item ops (add/remove/update a row, reorder) all re-broadcast as a plain
    // property_update carrying the whole list back in .value — that's expected and
    // frequent (every field blur triggers one), so it's excluded from the toast to
    // avoid spamming the GM on every keystroke-ish edit.
    const isListUpdate = event.command === "property_update" && parseListValue(event.data?.value) !== null;

    setProperties((prev) => {
      let next = [...prev];
      if (event.command === "property_update") {
        const idx = next.findIndex((x) => x.id === event.data.id);
        if (idx !== -1) next[idx] = event.data;
        if (!isListUpdate) toaster.create({ description: `Property "${event.data?.name}" updated`, type: "success", duration: 4000 });
      } else if (event.command === "property_add" && event.data.parentId === dto.id) {
        const optimisticIdx = next.findIndex((x) => x.toAdd && x.name === event.data.name);
        if (optimisticIdx !== -1) next[optimisticIdx] = event.data;
        else next.push(event.data);
        toaster.create({ description: `Property "${event.data?.name}" added`, type: "success", duration: 4000 });
      } else if (event.command === "property_remove") {
        // Server now broadcasts a full PropertyDTO for removes too (previously
        // a bare property ID string).
        const idx = next.findIndex((x) => x.id === event.data.id);
        const name = next[idx]?.name;
        next = next.filter((_, i) => i !== idx);
        toaster.create({ description: `Property "${name}" removed`, type: "success", duration: 4000 });
      }
      return next;
    });

    // Mirror the same targeted change onto the "saved" baseline only — never a full
    // re-baseline from `next`, which would silently fold in whatever unrelated rows
    // the GM has pending (toAdd/toDel/toEdit) and make Reset a no-op for them.
    setOriginalProperties((prevOriginal) => {
      let nextOriginal = [...prevOriginal];
      if (event.command === "property_update") {
        const idx = nextOriginal.findIndex((x) => x.id === event.data.id);
        if (idx !== -1) nextOriginal[idx] = event.data;
      } else if (event.command === "property_add" && event.data.parentId === dto.id) {
        if (!nextOriginal.some((x) => x.id === event.data.id)) nextOriginal.push(event.data);
      } else if (event.command === "property_remove") {
        nextOriginal = nextOriginal.filter((x) => x.id !== event.data.id);
      }
      return nextOriginal;
    });
  };

  // ── derived data ────────────────────────────────────────────────────────

  const filteredData = React.useMemo(
    () => properties.filter((x) => x.name?.toLowerCase().includes(search.toLowerCase())),
    [properties, search]
  );

  React.useEffect(() => { setPage(1); }, [search]);

  const pageData = filteredData.slice((page - 1) * COUNT, page * COUNT);
  const pendingCount = properties.filter((p) => p.toAdd || p.toDel || p.toEdit).length;

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <BasePanel>
      {/* Search + add */}
      <HStack px={2} pt={2} pb={1} gap={2}>
        <Box flex="1">
          <SearchInput value={search} onChange={setSearch} />
        </Box>
        <Button size="xs" variant="outline" onClick={handleAdd}>
          <Icon as={IoMdAdd} mr={1} /> Add
        </Button>
        <Button size="xs" variant="outline" onClick={handleAddList}>
          <Icon as={IoMdAdd} mr={1} /> Add List
        </Button>
      </HStack>

      {pendingCount > 0 && (
        <Flex px={2} pb={1}>
          <Badge colorPalette="orange" variant="subtle" fontSize="xs">
            {pendingCount} unsaved change{pendingCount !== 1 ? "s" : ""}
          </Badge>
        </Flex>
      )}

      <DDataTable
        data={pageData}
        count={COUNT}
        total={filteredData.length}
        page={page}
        GetData={setPage}
        GenerateHeader={() => (
          <>
            <Table.ColumnHeader>Name</Table.ColumnHeader>
            <Table.ColumnHeader>Value</Table.ColumnHeader>
            <Table.ColumnHeader width="36px">
              <Tooltip content="Protected properties are stored on the server only — their value is never sent to clients">
                <Icon as={FaLock} boxSize={3} color="gray.400" />
              </Tooltip>
            </Table.ColumnHeader>
            <Table.ColumnHeader width="36px" />
          </>
        )}
        GenerateRow={(item) => {
          const idOrTempId = item.id ?? item._tempId;
          return (
            <PropertyRow
              key={idOrTempId}
              property={item}
              onNameChange={handleNameChange}
              onValueChange={handleValueChange}
              onProtectedToggle={handleProtectedToggle}
              onDelete={handleDelete}
              expanded={expandedIds.has(idOrTempId)}
              onToggleExpand={handleToggleExpand}
            />
          );
        }}
        fallback={
          <Table.Row>
            <Table.Cell colSpan={4}>
              <Text fontSize="sm" color="gray.400" textAlign="center" py={4}>
                No properties found.
              </Text>
            </Table.Cell>
          </Table.Row>
        }
      />

      <Box borderTop="1px solid" borderColor="whiteAlpha.100" pt={2} px={2} pb={2}>
        <HStack gap={2}>
          <Button size="sm" variant="outline" disabled={pendingCount === 0} onClick={handleSave}>
            Save{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Button>
          <Button size="sm" variant="ghost" disabled={pendingCount === 0} onClick={handleReset}>
            Reset
          </Button>
        </HStack>
      </Box>

      <Subscribable commandPrefix="property" onMessage={handleMessage} />
    </BasePanel>
  );
};

export default PropertiesSettingsPanel;
