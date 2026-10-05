import * as React from "react";
import { Badge, Box, Button, Flex, HStack, Input, Text } from "@chakra-ui/react";
import { FaExchangeAlt } from "react-icons/fa";
import { StepField } from "./StepField";
import { StepPicker } from "./StepPicker";
import { T, categoryColor } from "./editorTheme";

// Editing panel for the selected step: its type, what it does, and one field per argument.
// After a traced run it also shows the variables as they were when this step finished.

// Arguments with a ShowIf condition only appear when the controlling field matches.
export function isArgVisible(arg, data) {
  if (!arg.conditionField || arg.conditionValue == null) return true;
  const actual = data?.[arg.conditionField];
  const expected = String(arg.conditionValue).toLowerCase();
  if (typeof actual === "boolean") return expected === "true" ? actual : !actual;
  return String(actual ?? "").toLowerCase() === expected;
}

const formatValue = (v) => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return v;
  try { return JSON.stringify(v); } catch { return String(v); }
};

const LastRun = ({ trace }) => {
  const vars = trace?.variables;
  if (!vars) return null;
  const entries = Object.entries(vars);
  return (
    <Box mt={4}>
      <Text fontSize="2xs" color={T.muted} textTransform="uppercase" letterSpacing="wider" mb={1}>
        Last run · variables after this step
      </Text>
      <Box borderWidth="1px" borderColor={T.border} borderRadius="md" maxH="220px" overflowY="auto">
        {entries.length === 0 && <Text fontSize="xs" color={T.faint} p={2}>No variables.</Text>}
        {entries.map(([k, v]) => (
          <HStack key={k} px={2} py="2px" gap={2} align="baseline" borderBottomWidth="1px" borderColor={T.border}>
            <Text fontSize="xs" fontFamily="mono" color={T.token} flexShrink={0}>{k}</Text>
            <Text fontSize="xs" fontFamily="mono" color={T.text} wordBreak="break-all">{formatValue(v)}</Text>
          </HStack>
        ))}
      </Box>
    </Box>
  );
};

export const StepInspector = ({
  step, index, def, stepDefinitions, variables, knownNames, actionOptions, trace,
  onChangeType, onChangeData, onFieldBlur,
}) => {
  const [picking, setPicking] = React.useState(false);

  if (!step) {
    return (
      <Flex h="100%" align="center" justify="center" p={6}>
        <Text fontSize="sm" color={T.faint} textAlign="center">Select a step to edit it,<br />or add one with “Add step”.</Text>
      </Flex>
    );
  }

  const data = step.Data ?? {};
  const args = (def?.arguments ?? []).filter((a) => isArgVisible(a, data));
  const field = (name) => ({
    value: data[name],
    onChange: (v) => onChangeData(name, v),
    onBlur: onFieldBlur,
  });

  return (
    <Box p={3}>
      <HStack gap={2} mb={1}>
        <Text fontSize="xs" color={T.faint}>Step {index + 1}</Text>
        {def && <Badge size="sm" variant="subtle" colorPalette={categoryColor(def.category)}>{def.category}</Badge>}
      </HStack>
      <HStack justify="space-between" mb={1}>
        <Text fontSize="md" color="white" fontWeight="semibold">{def?.name ?? step.Type}</Text>
        <Button size="xs" variant="ghost" onClick={() => setPicking(true)}><FaExchangeAlt /> Change type</Button>
      </HStack>
      {def?.description && <Text fontSize="xs" color={T.muted} mb={3}>{def.description}</Text>}
      {!def && (
        <Text fontSize="xs" color="orange.300" mb={3}>
          Unknown step type “{step.Type}”. The server has no step with this name, so it will be skipped.
        </Text>
      )}

      <Flex direction="column" gap={3}>
        {args.map((arg) => (
          <StepField
            key={arg.name} arg={arg} {...field(arg.name)}
            variables={variables} knownNames={knownNames} actionOptions={actionOptions}
          />
        ))}

        <Box pt={2} borderTopWidth="1px" borderColor={T.border}>
          <Text fontSize="xs" color="gray.300" mb="2px">Label</Text>
          <Input size="sm" borderColor={T.border} placeholder="Optional name shown above the summary"
            value={data.Label ?? ""} onChange={(e) => onChangeData("Label", e.target.value)} onBlur={onFieldBlur} />
          <Text fontSize="xs" color="gray.300" mb="2px" mt={2}>Comment</Text>
          <Input size="sm" borderColor={T.border} placeholder="Note for whoever edits this next"
            value={data.Comment ?? ""} onChange={(e) => onChangeData("Comment", e.target.value)} onBlur={onFieldBlur} />
        </Box>
      </Flex>

      <LastRun trace={trace} />

      <StepPicker
        open={picking} onClose={() => setPicking(false)} stepDefinitions={stepDefinitions}
        onPick={(d) => onChangeType(d.value)}
      />
    </Box>
  );
};

export default StepInspector;
