import * as React from "react";
import { Box, Button, Flex, HStack, Text } from "@chakra-ui/react";
import { T } from "./editorTheme";

// The variables a step can use, grouped by where they come from, with the fields the
// earlier steps declare (and their values from the last run). A click on a variable or a
// field inserts its token, e.g. %targets[0].name%, into the field being edited.

const GROUPS = [
  ["step", "Set by earlier steps"],
  ["input", "Given by whoever runs it"],
  ["hook", "From the trigger"],
  ["builtin", "Always there"],
];

const short = (value) => {
  if (value === undefined) return null;
  if (value === null) return "empty";
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") return "{…}";
  const text = String(value);
  return text.length > 24 ? text.slice(0, 23) + "…" : text;
};

const Value = ({ value }) => {
  const text = short(value);
  return text == null ? null : <Text as="span" fontSize="2xs" color={T.muted} truncate>{text}</Text>;
};

const FieldChip = ({ token, label, value, onInsert }) => (
  <Button size="2xs" variant="outline" borderColor={T.border} aria-label={token} title={token}
    onClick={() => onInsert(token)} fontFamily="mono" fontWeight="normal" gap={1}>
    <Text as="span" color={T.token}>{label}</Text>
    <Value value={value} />
  </Button>
);

const Variable = ({ v, value, onInsert }) => {
  const list = v.kind === "list";
  const item = list && Array.isArray(value) ? value[0] : value;
  return (
    <Box py="3px">
      <HStack gap={2}>
        <Text as="button" fontFamily="mono" fontSize="xs" color={T.token} cursor="pointer" onClick={() => onInsert(`%${v.name}%`)}>
          {v.name}
        </Text>
        {list && <Text fontSize="2xs" color={T.faint}>list</Text>}
        <Value value={value} />
      </HStack>
      {v.fields?.length > 0 && (
        <Flex gap={1} wrap="wrap" pl={3} mt="2px">
          {v.fields.map((f) => (
            <FieldChip key={f} label={f} token={list ? `%${v.name}[0].${f}%` : `%${v.name}.${f}%`}
              value={item && typeof item === "object" ? item[f] : undefined} onInsert={onInsert} />
          ))}
        </Flex>
      )}
    </Box>
  );
};

export const VariablesPanel = ({ variables, values, onInsert }) => (
  <Box>
    {GROUPS.map(([source, title]) => {
      const group = (variables ?? []).filter((v) => v.source === source);
      if (group.length === 0) return null;
      return (
        <Box key={source} mb={2}>
          <Text fontSize="2xs" color={T.faint} textTransform="uppercase" letterSpacing="wide">{title}</Text>
          {group.map((v) => <Variable key={v.name} v={v} value={values ? values[v.name] : undefined} onInsert={onInsert} />)}
        </Box>
      );
    })}
  </Box>
);

export default VariablesPanel;
