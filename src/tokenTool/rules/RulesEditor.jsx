import * as React from "react";
import { Box, Button, Code, Flex, IconButton, Input, NativeSelect, Stack, Table, Text } from "@chakra-ui/react";
import { FaPlus } from "@react-icons/all-files/fa/FaPlus";
import { FaTimes } from "@react-icons/all-files/fa/FaTimes";
import { ColorField, FieldRow, Rows } from "../settingsTable";
import { RULE_KINDS, PICKABLE_KINDS, parseRule, buildRule, targetType, defaultParams, convertLegacy } from "./ruleKinds";

// Rules (propDeps) as rows a creator edits: set [target] from [source] as [kind], then the
// kind's settings, with the expression it writes shown under it. Used for a part's own
// rules and for the token picture's. Every rule is editable, a pattern's too.

const SOURCES = [["card", "Card"], ["element", "Token"], ["map", "Map"], ["game", "Game"]];
const COLOURS = new Set(["fill", "stroke", "backgroundColor"]);

/** What a rule writes, to show under it. */
const written = (dep) => dep.expression ?? (dep.dtoProperty !== undefined ? `%${dep.dtoProperty}%` : "");

function Select({ label, value, options, onChange }) {
  return (
    <NativeSelect.Root size="xs">
      <NativeSelect.Field aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, title]) => <option key={v} value={v}>{title}</option>)}
      </NativeSelect.Field>
      <NativeSelect.Indicator />
    </NativeSelect.Root>
  );
}

const Text1 = ({ label, value, onChange, placeholder }) => (
  <Input size="xs" aria-label={label} placeholder={placeholder ?? label} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
);

// A value the rule gives: a colour for colour targets, text otherwise.
const ValueField = ({ colour, label, value, onChange }) =>
  colour ? <ColorField label={label} value={value} onChange={onChange} /> : <Text1 label={label} value={value} onChange={onChange} />;

/** The settings of one kind. */
function KindFields({ rule, set }) {
  const p = rule.params;
  const colour = COLOURS.has(rule.target);
  const property = <FieldRow label="Property"><Text1 label="Property" placeholder="e.g. hp" value={p.property} onChange={(property) => set({ property })} /></FieldRow>;
  switch (rule.kind) {
    case "direct":
      return property;
    case "range":
      return (
        <>
          {property}
          <FieldRow label="From">
            <Flex gap="4px">
              <Text1 label="From min" value={p.from[0]} onChange={(v) => set({ from: [v, p.from[1]] })} />
              <Text1 label="From max" value={p.from[1]} onChange={(v) => set({ from: [p.from[0], v] })} />
            </Flex>
          </FieldRow>
          <FieldRow label="Onto">
            <Flex gap="4px">
              <Text1 label="To min" value={p.to[0]} onChange={(v) => set({ to: [v, p.to[1]] })} />
              <Text1 label="To max" value={p.to[1]} onChange={(v) => set({ to: [p.to[0], v] })} />
            </Flex>
          </FieldRow>
        </>
      );
    case "thresholds":
      return (
        <>
          {property}
          <FieldRow label="Max"><Text1 label="Max" placeholder="a number or a property" value={p.max} onChange={(max) => set({ max })} /></FieldRow>
          <FieldRow label="Steps">
            <Rows items={p.steps} columns={[["upTo", "Up to %", "number"], ["value", "Value", colour ? "color" : "text"]]} addLabel="Add step"
              make={(steps) => ({ upTo: 100, value: steps.at(-1)?.value ?? "" })} onChange={(steps) => set({ steps })} />
          </FieldRow>
          <FieldRow label="Otherwise"><ValueField colour={colour} label="Otherwise" value={p.fallback} onChange={(fallback) => set({ fallback })} /></FieldRow>
        </>
      );
    case "table":
      return (
        <>
          {property}
          <FieldRow label="Values">
            <Rows items={p.entries} columns={[["when", "When"], ["value", "Value", colour ? "color" : "text"]]} addLabel="Add value"
              make={() => ({ when: "", value: "" })} onChange={(entries) => set({ entries })} />
          </FieldRow>
          <FieldRow label="Otherwise"><ValueField colour={colour} label="Otherwise" value={p.other} onChange={(other) => set({ other })} /></FieldRow>
        </>
      );
    case "switch":
      return (
        <>
          {property}
          <FieldRow label="When on"><ValueField colour={colour} label="When on" value={p.on} onChange={(on) => set({ on })} /></FieldRow>
          <FieldRow label="When off"><ValueField colour={colour} label="When off" value={p.off} onChange={(off) => set({ off })} /></FieldRow>
        </>
      );
    case "formula":
      return (
        <>
          <FieldRow label="Formula"><Text1 label="Formula" placeholder="%hp% / %maxhp%" value={p.formula} onChange={(formula) => set({ formula })} /></FieldRow>
          {/* Math's first argument: `value` in the formula. */}
          <FieldRow label="value ="><Text1 label="value" placeholder="0" value={p.value} onChange={(value) => set({ value })} /></FieldRow>
        </>
      );
    default:
      return <FieldRow label="Expression"><Text1 label="Expression" value={p.text} onChange={(text) => set({ text })} /></FieldRow>;
  }
}

function RuleRow({ rule, listId, onChange, onRemove }) {
  const readOnly = RULE_KINDS[rule.kind].readOnly;
  const retarget = (target) => onChange({ ...rule, target, type: targetType(target) });
  const set = (patch) => onChange({ ...rule, params: { ...rule.params, ...patch } });
  const converted = readOnly ? convertLegacy(rule.params.dep) : null;
  return (
    <Box role="group" aria-label={`Rule: ${rule.target}`} borderWidth="1px" borderRadius="md" p="4px 6px">
      <Table.Root size="sm">
        <Table.Body>
          <FieldRow label="Set">
            <Flex gap="4px" align="center">
              <Input size="xs" aria-label="Set" list={listId} value={rule.target ?? ""} onChange={(e) => retarget(e.target.value)} />
              <IconButton size="2xs" variant="ghost" aria-label="Remove rule" onClick={onRemove}><FaTimes /></IconButton>
            </Flex>
          </FieldRow>
          <FieldRow label="From">
            <Select label="From" value={rule.source ?? "card"} options={SOURCES} onChange={(source) => onChange({ ...rule, source })} />
          </FieldRow>
          {readOnly ? (
            <FieldRow label="As">
              <Flex gap="6px" align="center" wrap="wrap">
                <Text fontSize="xs">Old syntax (dtoProperty + rule): edit it in the JSON.</Text>
                {converted && <Button size="2xs" variant="outline" onClick={() => onChange(parseRule(converted))}>Convert</Button>}
              </Flex>
            </FieldRow>
          ) : (
            <>
              <FieldRow label="As">
                <Select label="As" value={rule.kind} options={PICKABLE_KINDS.map((id) => [id, RULE_KINDS[id].title])}
                  onChange={(kind) => onChange({ ...rule, kind, params: defaultParams(kind, rule.params) })} />
              </FieldRow>
              <KindFields rule={rule} set={set} />
            </>
          )}
        </Table.Body>
      </Table.Root>
      <Code fontSize="10px" color="fg.muted" bg="transparent" whiteSpace="pre-wrap" wordBreak="break-all">{written(buildRule(rule))}</Code>
    </Box>
  );
}

/**
 * @param rules   the propDeps
 * @param targets the object properties offered for a rule to set (any can be typed)
 */
export function RulesEditor({ rules = [], targets = [], onChange }) {
  const listId = React.useId();
  // The rules as edited: a kind stays what the creator picked even while a field is half
  // typed. Rules changed from outside (the JSON) are read again.
  const [state, setState] = React.useState(() => rules.map(parseRule));
  const sent = React.useRef(rules);
  if (JSON.stringify(rules) !== JSON.stringify(sent.current)) {
    sent.current = rules;
    setState(rules.map(parseRule));
  }
  const emit = (next) => {
    setState(next);
    const deps = next.map(buildRule);
    sent.current = deps;
    onChange(deps);
  };
  const offered = targets;
  const add = () => {
    const used = new Set(state.map((r) => r.target));
    const target = offered.find((t) => !used.has(t)) ?? offered[0] ?? "opacity";
    emit([...state, { target, source: "card", type: targetType(target), kind: "direct", params: { property: "" } }]);
  };
  return (
    <Stack gap="6px">
      <datalist id={listId}>{offered.map((t) => <option key={t} value={t} />)}</datalist>
      {state.map((rule, i) => (
        <RuleRow key={i} rule={rule} listId={listId}
          onChange={(next) => emit(state.map((r, j) => (j === i ? next : r)))}
          onRemove={() => emit(state.filter((_, j) => j !== i))} />
      ))}
      <div>
        <Button size="2xs" variant="outline" aria-label="Add rule" onClick={add}><FaPlus /> Rule</Button>
      </div>
    </Stack>
  );
}

export default RulesEditor;
