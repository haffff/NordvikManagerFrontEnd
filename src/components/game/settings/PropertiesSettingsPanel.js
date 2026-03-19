import * as React from "react";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import WebSocketManagerInstance from "../WebSocketManager";
import Subscribable from "../../uiComponents/base/Subscribable";
import WebHelper from "../../../helpers/WebHelper";
import { IoIosRemoveCircleOutline, IoMdAdd } from "react-icons/io";
import { MdUndo } from "react-icons/md";
import DListItemButton from "../../uiComponents/base/List/ListItemDetails/DListItemButton";
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

const PropertyRow = React.memo(({ property, onNameChange, onValueChange, onDelete }) => {
  const bg = rowBg(property);
  return (
    <Table.Row key={property.id} style={{ backgroundColor: bg, transition: "background-color 0.15s" }}>
      <Table.Cell>
        <Input
          size="xs"
          variant="flushed"
          fontWeight="semibold"
          value={property.name}
          onChange={(e) => onNameChange(property.id ?? property._tempId, e.target.value)}
        />
      </Table.Cell>
      <Table.Cell>
        <Input
          size="xs"
          variant="flushed"
          value={property.value}
          onChange={(e) => onValueChange(property.id ?? property._tempId, e.target.value)}
        />
      </Table.Cell>
      <Table.Cell width="40px">
        <DListItemButton
          label={property.toDel ? "Undo remove" : "Remove"}
          color={property.toDel ? "orange.400" : "red.400"}
          icon={property.toDel ? MdUndo : IoIosRemoveCircleOutline}
          onClick={() => onDelete(property.id ?? property._tempId)}
        />
      </Table.Cell>
    </Table.Row>
  );
});

// ─── Main panel ───────────────────────────────────────────────────────────────

export const PropertiesSettingsPanel = ({
  dto,
  type,
  initProperties,
}) => {
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

  // ── immutable helpers ───────────────────────────────────────────────────

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

  const handleDelete = React.useCallback((idOrTempId) => {
    setProperties((prev) =>
      prev.flatMap((p) => {
        if ((p.id ?? p._tempId) !== idOrTempId) return [p];
        if (p.toAdd) return [];                          // new unsaved row — just remove it
        return [{ ...p, toDel: !p.toDel }];             // toggle mark
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
        EntityName: type,
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
        // Replace the optimistic toAdd row (matched by name) or append
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
    () => properties.filter((x) => x.name.toLowerCase().includes(search.toLowerCase())),
    [properties, search]
  );

  // Reset to page 1 when search changes
  React.useEffect(() => { setPage(1); }, [search]);

  const pageData = filteredData.slice((page - 1) * COUNT, page * COUNT);

  const pendingCount = properties.filter((p) => p.toAdd || p.toDel || p.toEdit).length;

  // ── render ──────────────────────────────────────────────────────────────

  return (
    <BasePanel>
      {/* Search + add row */}
      <HStack px={2} pt={2} pb={1} gap={2}>
        <Box flex="1">
          <SearchInput value={search} onChange={setSearch} />
        </Box>
        <Button size="xs" variant="outline" onClick={handleAdd}>
          <Icon as={IoMdAdd} mr={1} /> Add
        </Button>
      </HStack>

      {/* Pending-changes indicator */}
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
            <Table.ColumnHeader />
          </>
        )}
        GenerateRow={(item) => (
          <PropertyRow
            key={item.id ?? item._tempId}
            property={item}
            onNameChange={handleNameChange}
            onValueChange={handleValueChange}
            onDelete={handleDelete}
          />
        )}
        fallback={
          <Table.Row>
            <Table.Cell colSpan={3}>
              <Text fontSize="sm" color="gray.400" textAlign="center" py={4}>
                No properties found.
              </Text>
            </Table.Cell>
          </Table.Row>
        }
      />

      {/* Footer actions */}
      <Box borderTop="1px solid" borderColor="whiteAlpha.100" pt={2} px={2} pb={2}>
        <HStack gap={2}>
          <Button
            size="sm"
            variant="outline"
            disabled={pendingCount === 0}
            onClick={handleSave}
          >
            Save{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pendingCount === 0}
            onClick={handleReset}
          >
            Reset
          </Button>
        </HStack>
      </Box>

      <Subscribable commandPrefix={"property"} onMessage={handleMessage} />
    </BasePanel>
  );
};

export default PropertiesSettingsPanel;
