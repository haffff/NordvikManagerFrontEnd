import * as React from "react";
import { Box, Button, HStack, IconButton, Input, Spinner, Text } from "@chakra-ui/react";
import { FaPlay } from "@react-icons/all-files/fa/FaPlay";
import { FaMapMarkerAlt } from "@react-icons/all-files/fa/FaMapMarkerAlt";
import { FaPlus } from "@react-icons/all-files/fa/FaPlus";
import { FaTimes } from "@react-icons/all-files/fa/FaTimes";
import { T } from "./editorTheme";

// Arguments to run the action with, as name/value rows. Rows are pre-filled from the
// action's inputs (names it uses but never defines) and remembered per action.

const storageKey = (actionId) => `nm.actionEditor.runArgs.${actionId}`;

const loadRows = (actionId) => {
  try { return JSON.parse(localStorage.getItem(storageKey(actionId)) ?? "[]"); } catch { return []; }
};
const saveRows = (actionId, rows) => {
  try { localStorage.setItem(storageKey(actionId), JSON.stringify(rows)); } catch { /* optional */ }
};

// Saved rows first (keeping their values), then any input not yet listed.
export function mergeRows(saved, inputs) {
  const rows = saved.filter((r) => r && typeof r.name === "string");
  inputs.forEach((n) => { if (!rows.some((r) => r.name === n)) rows.push({ name: n, value: "" }); });
  return rows;
}

// onRunFromMap: run it as a map tool or menu click would, after picking on the map.
export const RunBar = ({ actionId, inputs, onRun, onRunFromMap, running, result, dirty }) => {
  const [rows, setRows] = React.useState(() => mergeRows(loadRows(actionId), inputs));

  React.useEffect(() => { setRows(mergeRows(loadRows(actionId), inputs)); }, [actionId, inputs.join("|")]);

  const update = (next) => { setRows(next); saveRows(actionId, next); };
  const setRow = (i, patch) => update(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const rowArgs = () => {
    const args = {};
    rows.forEach((r) => { if (r.name.trim()) args[r.name.trim()] = r.value; });
    return args;
  };
  const run = () => onRun(rowArgs());

  return (
    <Box borderWidth="1px" borderColor={T.border} borderRadius="md" p={2} bg={T.raised}>
      <HStack mb={rows.length ? 2 : 0} gap={2}>
        <Text fontSize="xs" color={T.muted} flex={1}>
          {rows.length ? "Run with these values:" : "This action needs no inputs."}
        </Text>
        {result && !running && (
          <Text fontSize="xs" color={result.state === "Faulted" ? "red.300" : "green.300"}>
            {result.state === "Faulted" ? `Failed: ${result.error ?? ""}` : result.state === "Exited" ? "Stopped by Exit" : "Finished"}
          </Text>
        )}
        {running && <Spinner size="xs" color="blue.300" />}
        {onRunFromMap && (
          <Button size="xs" variant="outline" onClick={() => onRunFromMap(rowArgs())} disabled={running}
            title="Click a point and pick tokens on the map, then Done: the action runs as a map tool or menu click would.">
            <FaMapMarkerAlt /> From map
          </Button>
        )}
        <Button size="xs" colorPalette="green" variant="outline" onClick={run} disabled={running}>
          <FaPlay /> {dirty ? "Save & run" : "Run"}
        </Button>
      </HStack>
      {rows.map((r, i) => (
        <HStack key={i} gap={1} mb={1}>
          <Input size="xs" w="35%" fontFamily="mono" placeholder="name" borderColor={T.border}
            value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} />
          <Input size="xs" flex={1} fontFamily="mono" placeholder="value" borderColor={T.border}
            value={r.value} onChange={(e) => setRow(i, { value: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") run(); }} />
          <IconButton size="2xs" variant="ghost" aria-label="Remove argument"
            onClick={() => update(rows.filter((_, j) => j !== i))}><FaTimes /></IconButton>
        </HStack>
      ))}
      <Button size="2xs" variant="ghost" color={T.accent} onClick={() => update([...rows, { name: "", value: "" }])}>
        <FaPlus /> Argument
      </Button>
    </Box>
  );
};

export default RunBar;
