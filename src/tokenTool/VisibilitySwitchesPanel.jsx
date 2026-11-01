import * as React from "react";
import { Box, Button, Flex, IconButton, Input, Stack, Table, Text } from "@chakra-ui/react";
import { FaTrash } from "@react-icons/all-files/fa/FaTrash";
import { SegmentedField } from "../components/game/settings/SettingsPanel";
import { maskSettingFields } from "../helpers/maskSettings";
import { PATTERNS } from "./patterns";
import { splitParts, joinParts, groupsOf, renameGroup, removeGroup, isGroupKey, nameOfPart } from "./patterns/parts";
import { FieldRow } from "./settingsTable";

// The token's visibility switches (tokenData.maskGroup + label in the file; "mask groups"
// in the game's code): each is one Visible / GM only / Hidden setting in a game's map and
// token settings, named by its label, for every part on it. A part picks its switch in
// Parts. Here a switch is named, given a key, tried out in the preview through the sample
// values (mask_<key>_enabled / _gmonly on the map or the token), or removed.

const kindOf = (part) => (part.pattern === "custom" ? "Custom" : PATTERNS[part.pattern].title);

// The game's own four-way choice, stored as two properties, on the map or the token.
function TryRow({ title, source, group, values, onValue }) {
  const field = maskSettingFields([{ maskGroup: group.key, label: group.label }])[0];
  const get = (name) => values?.[source]?.[name];
  const value = field.fromProperties(get);
  const choose = (choice) => {
    for (const [name, v] of Object.entries(field.toProperties(choice))) onValue(source, name, v);
  };
  return (
    <FieldRow label={title}>
      <Box role="group" aria-label={title}>
        {/* It keeps its own choice: a new value from outside starts it again. */}
        <SegmentedField key={value} options={field.options} value={value} onChange={choose} />
      </Box>
    </FieldRow>
  );
}

function KeyField({ group, groups, onRename }) {
  const [draft, setDraft] = React.useState(null);
  const [problem, setProblem] = React.useState(null);
  // A key that changes from outside (this card now shows another switch, after one was
  // removed) drops what was being typed; the key this field just set doesn't.
  const sent = React.useRef(group.key);
  React.useEffect(() => {
    if (group.key === sent.current) return;
    sent.current = group.key;
    setDraft(null);
    setProblem(null);
  }, [group.key]);
  const change = (key) => {
    setDraft(key);
    if (key === group.key) return setProblem(null);
    if (!isGroupKey(key)) return setProblem("A key is letters, digits and _ only.");
    if (groups.some((g) => g.key === key)) return setProblem(`"${key}" is already used by another switch.`);
    setProblem(null);
    sent.current = key;
    onRename(key);
  };
  return (
    <Stack gap="2px">
      <Input size="xs" aria-label="Key" value={draft ?? group.key} onChange={(e) => change(e.target.value)} />
      {problem && <Text fontSize="xs" color="fg.error">{problem}</Text>}
    </Stack>
  );
}

function SwitchCard({ group, groups, parts, values, onValue, onGroup, onRemove }) {
  const [removing, setRemoving] = React.useState(false);
  // A new card in this place (after a removal) isn't asked about.
  React.useEffect(() => setRemoving(false), [group.key]);
  const count = group.parts.length;
  return (
    <Box role="group" aria-label={`Visibility switch: ${group.label}`} borderWidth="1px" borderRadius="md" p="6px" bg="bg.subtle">
      <Flex align="center" gap="6px" mb="4px">
        <Text fontSize="sm" fontWeight="medium" flex="1" lineClamp={1}>{group.label}</Text>
        <IconButton size="2xs" variant="ghost" aria-label="Remove switch" title="Remove switch" onClick={() => setRemoving(true)}>
          <FaTrash />
        </IconButton>
      </Flex>
      {removing && (
        <Flex align="center" gap="6px" mb="4px" wrap="wrap">
          <Text fontSize="xs" flex="1" minW="160px">
            {count === 1 ? "Its part is" : `Its ${count} parts are`} then always shown, and settings games made for "{group.key}" no longer apply.
          </Text>
          <Button size="2xs" colorPalette="red" onClick={() => { setRemoving(false); onRemove(); }}>Remove</Button>
          <Button size="2xs" variant="ghost" onClick={() => setRemoving(false)}>Cancel</Button>
        </Flex>
      )}
      <Table.Root size="sm">
        <Table.Body>
          {/* The name a game's map and token settings show it by (tokenData.label). */}
          <FieldRow label="Shown as">
            <Input size="xs" aria-label="Shown as" value={group.label}
              onChange={(e) => onGroup({ key: group.key, label: e.target.value })} />
          </FieldRow>
          <FieldRow label="Key">
            <KeyField group={group} groups={groups} onRename={(key) => onGroup({ key, label: group.label })} />
          </FieldRow>
          <FieldRow label="Used by">
            <Stack gap="0">
              {group.parts.map((i) => <Text key={i} fontSize="xs">{kindOf(parts[i])}: {nameOfPart(parts[i])}</Text>)}
            </Stack>
          </FieldRow>
          <TryRow title="On the map" source="map" group={group} values={values} onValue={onValue} />
          <TryRow title="On the token" source="element" group={group} values={values} onValue={onValue} />
        </Table.Body>
      </Table.Root>
      <Text fontSize="xs" color="fg.muted" mt="4px">
        Games keep this switch's map and token settings under its key (mask_{group.key}_…): changing the key of a released token drops the settings games already made.
      </Text>
    </Box>
  );
}

export function VisibilitySwitchesPanel({ definition, onChange, values, onValue }) {
  const { base, parts } = React.useMemo(() => splitParts(definition), [definition]);
  const groups = React.useMemo(() => groupsOf(parts), [parts]);
  const save = (next) => onChange(joinParts(base, next));
  return (
    <Stack gap="8px">
      <Text fontSize="xs" color="fg.muted">
        A visibility switch is one setting a GM flips in a game's map and token settings (Visible / GM only / Hidden) for every part on it.
        Pick a part's switch, or none (always shown), in its settings in Parts. GM only looks like Visible here while View as GM is on.
      </Text>
      {groups.length === 0 && <Text fontSize="xs" color="fg.muted">No visibility switches yet: give a part one in its settings in Parts.</Text>}
      {/* By position: a switch's key changes as it's typed, and a remount would lose focus. */}
      {groups.map((group, i) => (
        <SwitchCard key={i} group={group} groups={groups} parts={parts} values={values} onValue={onValue}
          onGroup={(next) => save(renameGroup(parts, group.key, next))}
          onRemove={() => save(removeGroup(parts, group.key))} />
      ))}
    </Stack>
  );
}

export default VisibilitySwitchesPanel;
