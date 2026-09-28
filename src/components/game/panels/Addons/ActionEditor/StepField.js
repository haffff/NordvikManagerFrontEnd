import * as React from "react";
import { Box, HStack, Text } from "@chakra-ui/react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { Switch } from "../../../../ui/switch";
import CommandExecutionHelper from "../../../../../helpers/CommandExecutionHelper";
import { TokenInput } from "./TokenInput";
import { humanizeArgName } from "./stepSummary";
import { T } from "./editorTheme";

// One argument of a step, rendered by the type the backend reports for it.

// Arg types whose values come from a live list (players, materials, maps…); the user can
// still type an id or a %variable% instead.
const PICKER_TYPES = new Set(["audioresourceid", "resourceid", "playlistid", "mapid", "playerid", "layoutid"]);

const usePickerOptions = (type) => {
  const [options, setOptions] = React.useState([]);
  React.useEffect(() => {
    if (!PICKER_TYPES.has(type)) return undefined;
    let cancelled = false;
    CommandExecutionHelper.GetArgCompletions(type)
      .then((list) => { if (!cancelled && Array.isArray(list)) setOptions(list.map((o) => ({ value: String(o.value), label: o.label ?? String(o.value) }))); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [type]);
  return options;
};

const Label = ({ arg }) => (
  <HStack gap={2} mb="2px" align="baseline">
    <Text fontSize="xs" color="gray.300" fontWeight="medium">{humanizeArgName(arg.name)}</Text>
    {arg.isOutput && <Text fontSize="2xs" color={T.accent}>creates a variable</Text>}
  </HStack>
);

const Help = ({ children }) =>
  children ? <Text fontSize="2xs" color={T.muted} mt="2px" whiteSpace="pre-wrap">{children}</Text> : null;

export const StepField = ({ arg, value, onChange, onBlur, variables, knownNames, actionOptions }) => {
  const type = (arg.type ?? "string").toLowerCase();
  const pickerOptions = usePickerOptions(type);

  if (type === "boolean") {
    return (
      <HStack justify="space-between" gap={3}>
        <Box>
          <Label arg={arg} />
          <Help>{arg.description}</Help>
        </Box>
        <Switch checked={value === true || value === "true"} onCheckedChange={(e) => { onChange(e.checked); onBlur?.(); }} />
      </HStack>
    );
  }

  if (type === "code") {
    return (
      <Box>
        <Label arg={arg} />
        <Box borderWidth="1px" borderColor={T.border} borderRadius="md" overflow="hidden" fontSize="13px">
          <CodeMirror
            value={value ?? ""}
            theme="dark"
            minHeight="120px"
            maxHeight="420px"
            extensions={[javascript()]}
            basicSetup={{ foldGutter: false, highlightActiveLine: false }}
            onChange={(v) => onChange(v)}
            onBlur={onBlur}
          />
        </Box>
        <Help>{"Read variables as vars.name (e.g. vars.hp). %tokens% are not filled in here. Return an object to set variables."}</Help>
      </Box>
    );
  }

  const isAction = type === "action";
  const isPicker = PICKER_TYPES.has(type);
  const multiline = type === "textarea";

  return (
    <Box>
      <Label arg={arg} />
      <TokenInput
        value={value == null ? "" : String(value)}
        onChange={onChange}
        onBlur={onBlur}
        multiline={multiline}
        rows={multiline ? 4 : undefined}
        mode={isAction || isPicker ? "whole" : "token"}
        options={isAction ? actionOptions : pickerOptions}
        variables={variables}
        knownNames={knownNames}
        placeholder={isAction ? "prefix/name" : isPicker ? "pick one, or type an id / %variable%" : undefined}
      />
      <Help>
        {arg.deferred && !isAction ? "Filled in by the step itself. " : ""}
        {arg.description}
      </Help>
    </Box>
  );
};

export default StepField;
