import * as React from "react";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import Subscribable from "../../uiComponents/base/Subscribable";
import { ActiveWebHelper as WebHelper } from "../../../helpers/transport";
import { IoMdAdd } from "react-icons/io";
import { FaLock, FaLockOpen } from "react-icons/fa";
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

// ─── Single property row ──────────────────────────────────────────────────────

const PropertyRow = React.memo(({ property, onNameChange, onValueChange, onProtectedToggle, onDelete }) => {
  const bg = rowBg(property);
  const idOrTempId = property.id ?? property._tempId;
  const isProtected = !!property.isProtected;

  return (
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

      {/* Value — masked when protected */}
      <Table.Cell>
        {isProtected ? (
          <Text fontSize="xs" color="gray.500" letterSpacing="0.15em" userSelect="none">
            ••••••
          </Text>
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
  );
});

// ─── Main panel ───────────────────────────────────────────────────────────────

export const PropertiesSettingsPanel = ({ dto, type, initProperties }) => {
  const [properties, setProperties] = React.useState(initProperties || []);
  const [originalProperties, setOriginalProperties] = React.useState(initProperties || []);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const COUNT = 10;

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
    setProperties((prev) => {
      let next = [...prev];
      if (event.command === "property_update") {
        const idx = next.findIndex((x) => x.id === event.data.id);
        if (idx !== -1) next[idx] = event.data;
        toaster.create({ description: `Property "${event.data?.name}" updated`, type: "success", duration: 4000 });
      } else if (event.command === "property_add" && (event.data.parentId === dto.id || event.data.parentID === dto.id)) {
        const optimisticIdx = next.findIndex((x) => x.toAdd && x.name === event.data.name);
        if (optimisticIdx !== -1) next[optimisticIdx] = event.data;
        else next.push(event.data);
        toaster.create({ description: `Property "${event.data?.name}" added`, type: "success", duration: 4000 });
      } else if (event.command === "property_remove") {
        const idx = next.findIndex((x) => x.id === event.data);
        const name = next[idx]?.name;
        next = next.filter((_, i) => i !== idx);
        toaster.create({ description: `Property "${name}" removed`, type: "success", duration: 4000 });
      }
      setOriginalProperties(structuredClone(next));
      return next;
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
        GenerateRow={(item) => (
          <PropertyRow
            key={item.id ?? item._tempId}
            property={item}
            onNameChange={handleNameChange}
            onValueChange={handleValueChange}
            onProtectedToggle={handleProtectedToggle}
            onDelete={handleDelete}
          />
        )}
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
