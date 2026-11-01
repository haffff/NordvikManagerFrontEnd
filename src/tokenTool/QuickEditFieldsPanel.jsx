import * as React from "react";
import { Badge, Box, Flex, IconButton, Stack, Table, Text } from "@chakra-ui/react";
import { FaPlus } from "@react-icons/all-files/fa/FaPlus";
import { FaArrowUp } from "@react-icons/all-files/fa/FaArrowUp";
import { FaArrowDown } from "@react-icons/all-files/fa/FaArrowDown";
import { FaTimes } from "@react-icons/all-files/fa/FaTimes";
import { MenuContent, MenuItem, MenuItemGroup, MenuRoot, MenuSeparator, MenuTrigger } from "../components/ui/menu";
import { collectTokenProperties } from "./collectTokenProperties";
import { Control, FieldRow, Section } from "./settingsTable";

// The token's quick-edit fields (the file's editableProps): what the gear next to a
// selected token offers (TokenQuickEditOverlay). Each field reads and writes one
// property of the token or its card. Every change hands the whole token file to onChange.

const f = (key, label, kind, options) => ({ key, label, kind, options });
const SECTIONS = [
  ["Content", [f("label", "Label", "text"), f("dtoProperty", "Property", "text"),
    f("source", "Read from", "select", [["card", "Card"], ["element", "Token"]])]],
  ["Field", [f("type", "Kind", "select", [["text", "Text"], ["boolean", "Checkbox"], ["image", "Image"]]),
    f("default", "Default", "text"), f("group", "Row group", "text"), f("name", "Key", "text")]],
];
// Left out of the file when emptied (the overlay has defaults for them).
const OPTIONAL = new Set(["label", "type", "default", "group"]);

const freeName = (taken) => {
  let n = 1;
  while (taken.includes(`field${n}`)) n++;
  return n;
};

function AddFieldMenu({ offered, onAdd }) {
  return (
    <MenuRoot positioning={{ placement: "bottom-start" }}>
      <MenuTrigger asChild>
        <IconButton size="xs" variant="outline" aria-label="Add field" title="Add field"><FaPlus /></IconButton>
      </MenuTrigger>
      <MenuContent minW="240px" maxH="360px" overflowY="auto" zIndex={9999}>
        {offered.length > 0 && (
          <MenuItemGroup title="A property the token reads">
            {offered.map((prop) => (
              <MenuItem key={`${prop.source}:${prop.name}`} value={`${prop.source}:${prop.name}`} onClick={() => onAdd(prop)}>
                <Text fontSize="sm" flex="1">{prop.name}</Text>
                <Text fontSize="xs" color="fg.muted">{prop.source === "card" ? "card" : "token"}</Text>
              </MenuItem>
            ))}
          </MenuItemGroup>
        )}
        {offered.length > 0 && <MenuSeparator />}
        <MenuItem value="new" onClick={() => onAdd(null)}>
          <Text fontSize="sm">New field</Text>
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  );
}

export function QuickEditFieldsPanel({ definition, onChange }) {
  const fields = definition.editableProps ?? [];
  const save = (next) => onChange({ ...definition, editableProps: next });

  // Properties the token reads that no field edits yet.
  const offered = React.useMemo(() => collectTokenProperties(definition)
    .filter((p) => !fields.some((x) => x.dtoProperty === p.name && x.source === p.source)), [definition, fields]);

  const add = (prop) => {
    if (prop) {
      save([...fields, { name: prop.name, dtoProperty: prop.name, label: prop.name, source: prop.source, ...(prop.kind === "bool" ? { type: "boolean" } : {}) }]);
      return;
    }
    const n = freeName(fields.map((x) => x.name));
    save([...fields, { name: `field${n}`, dtoProperty: `field${n}`, label: `Field ${n}`, source: "card" }]);
  };

  const change = (i, key, value) => save(fields.map((x, j) => {
    if (j !== i) return x;
    const next = { ...x, [key]: value };
    // The key follows the property while they're the same.
    if (key === "dtoProperty" && x.name === x.dtoProperty) next.name = value;
    if (OPTIONAL.has(key) && (value === "" || (key === "type" && value === "text" && x.type === undefined))) delete next[key];
    return next;
  }));
  const move = (i, by) => {
    const next = [...fields];
    const [x] = next.splice(i, 1);
    next.splice(i + by, 0, x);
    save(next);
  };

  return (
    <Stack gap="8px">
      <Flex align="center" gap="8px">
        <AddFieldMenu offered={offered} onAdd={add} />
        <Text fontSize="xs" color="fg.muted">What the gear next to a selected token lets players change.</Text>
      </Flex>
      {fields.length === 0 && <Text fontSize="xs" color="fg.muted">No quick-edit fields yet: add one with +.</Text>}
      {fields.map((x, i) => {
        const title = x.label || x.name;
        return (
          // By position: the key changes as the property is typed, and a remount would lose focus.
          <Box key={i} role="group" aria-label={`Quick-edit field: ${title}`} borderWidth="1px" borderRadius="md" p="4px 6px" bg="bg.subtle">
            <Flex gap="4px" align="center">
              <Text fontSize="sm" fontWeight="medium" flex="1" lineClamp={1}>{title}</Text>
              <Badge size="xs" variant="surface">{x.source === "element" ? "token" : "card"}.{x.dtoProperty}</Badge>
              <IconButton size="2xs" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><FaArrowUp /></IconButton>
              <IconButton size="2xs" variant="ghost" aria-label="Move down" disabled={i === fields.length - 1} onClick={() => move(i, 1)}><FaArrowDown /></IconButton>
              <IconButton size="2xs" variant="ghost" aria-label="Remove" onClick={() => save(fields.filter((_, j) => j !== i))}><FaTimes /></IconButton>
            </Flex>
            <Table.Root size="sm" mt="4px">
              <Table.Body>
                {SECTIONS.map(([section, rows]) => (
                  <React.Fragment key={section}>
                    <Section title={section} />
                    {rows.map((row) => (
                      <FieldRow key={row.key} label={row.label}>
                        <Control field={row} params={x} onChange={(v) => change(i, row.key, v)}
                          value={row.key === "type" ? x.type ?? "text" : x[row.key] === undefined ? "" : String(x[row.key])} />
                      </FieldRow>
                    ))}
                  </React.Fragment>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        );
      })}
    </Stack>
  );
}

export default QuickEditFieldsPanel;
