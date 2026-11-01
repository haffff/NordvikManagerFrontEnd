import * as React from "react";
import { Badge, Box, Button, Flex, IconButton, Input, NativeSelect, Stack, Table, Text } from "@chakra-ui/react";
import { FaArrowUp } from "@react-icons/all-files/fa/FaArrowUp";
import { FaArrowDown } from "@react-icons/all-files/fa/FaArrowDown";
import { FaTimes } from "@react-icons/all-files/fa/FaTimes";
import { FaChevronDown } from "@react-icons/all-files/fa/FaChevronDown";
import { FaChevronRight } from "@react-icons/all-files/fa/FaChevronRight";
import { FaPlus } from "@react-icons/all-files/fa/FaPlus";
import { DynamicIcon } from "../components/uiComponents/icons/DynamicIcon";
import { ColorField, Control, FieldRow, IconField, Rows, Section, WideRow } from "./settingsTable";
import { PATTERNS } from "./patterns";
import { splitParts, joinParts, updatePart, groupsOf, movePartToGroup, nameOfPart, renamePart, setPartRules } from "./patterns/parts";
import { RulesEditor } from "./rules/RulesEditor";
import { OPEN_CARD } from "./patterns/button";

// The token editor's part list: each part of the token file (a pattern with its
// settings, or a custom part edited in the JSON), to change, remove or reorder. Every
// change hands the whole token file to onChange. Settings are a table in sections, with
// the game's own colour and icon pickers.

const ANCHORS = ["left-top", "top", "right-top", "left", "center", "right", "left-bottom", "bottom", "right-bottom"];
const SOURCES = [["card", "Card"], ["element", "Token"]];
const f = (key, label, kind, options) => ({ key, label, kind, options });
const SOURCE = f("source", "Read from", "select", SOURCES);
const PLACEMENT = ["Placement", [f("anchor", "Anchor", "select", ANCHORS.map((a) => [a, a])), f("offsetX", "Offset X", "number"), f("offsetY", "Offset Y", "number")]];

const SCALE = f("scale", "Scale", "number");
const ROTATION = f("rotation", "Rotation", "number");
const FILL = [f("fill", "Fill", "color"), f("stroke", "Outline", "color"), f("strokeWidth", "Outline width", "number")];
const SHOWN_WHILE = [f("property", "Shown while", "text"), SOURCE];
// What a setting can't be: a scale of 0 hides the part, a polygon has at least 3 sides.
const LEAST = { scale: [0.01, 1], sides: [3, 3] };

// Each pattern's settings: [section, fields, extra?]; extra is a part-specific editor
// shown at the end of the section.
const SECTIONS = {
  bar: [
    ["Content", [f("value", "Value property", "text"), f("max", "Max property", "text"), SOURCE]],
    ["Appearance", [f("width", "Width", "number"), f("height", "Height", "number"), f("background", "Background", "color"), SCALE, ROTATION], "barColours"],
  ],
  label: [
    ["Content", [f("property", "Property", "text"), SOURCE]],
    ["Appearance", [f("fontSize", "Font size", "number"), f("fontFamily", "Font", "text"),
      f("fontWeight", "Weight", "select", [["normal", "Normal"], ["bold", "Bold"]]), f("color", "Colour", "color"),
      f("outline", "Outline", "color"), f("width", "Width", "number"), SCALE, ROTATION]],
  ],
  button: [
    ["Content", []],
    ["Appearance", [f("icon", "Icon", "icon"), f("color", "Colour", "color"), f("size", "Size", "number"), ROTATION]],
    ["Click", [f("onlySelected", "Only while selected", "checkbox")], "click"],
  ],
  iconSet: [
    ["Content", [SOURCE, f("inPicker", "Offer in the icon picker", "checkbox")]],
    ["Appearance", [f("size", "Icon size", "number"), ROTATION]],
    ["Icons", [], "icons"],
  ],
  ring: [
    ["Content", [f("property", "Colour from property", "text"), SOURCE]],
    ["Appearance", [f("color", "Colour", "color"), f("width", "Line width", "number"), f("otherColor", "Other values", "color")], "ringColours"],
  ],
  rect: [
    ["Content", SHOWN_WHILE],
    ["Appearance", [f("width", "Width", "number"), f("height", "Height", "number"), f("corner", "Corner radius", "number"), ...FILL, SCALE, ROTATION]],
  ],
  circle: [
    ["Content", SHOWN_WHILE],
    ["Appearance", [f("width", "Size", "number"), ...FILL, SCALE, ROTATION]],
  ],
  polygon: [
    ["Content", SHOWN_WHILE],
    ["Appearance", [f("sides", "Sides", "number"), f("width", "Width", "number"), f("height", "Height", "number"), ...FILL, SCALE, ROTATION]],
  ],
};

// A small table of rows (bar colour steps, ring colours), with add and remove.
const freeNumber = (taken) => {
  let n = taken.length + 1;
  while (taken.includes(n)) n++;
  return n;
};

// ── Icon cards (an icon set's icons) ─────────────────────────────────────────

function IconCards({ icons, group, onChange }) {
  const [picked, setPicked] = React.useState(null);
  const current = icons.find((i) => i.id === picked);
  const change = (patch) => {
    onChange(icons.map((i) => (i.id === picked ? { ...i, ...patch } : i)));
    if (patch.id !== undefined) setPicked(patch.id);
  };
  const add = () => {
    const n = freeNumber(icons.map((i) => Number(/^icon(\d+)$/.exec(i.id)?.[1])).filter(Boolean));
    const icon = { id: `icon${n}`, label: `Icon ${n}`, iconPack: "gi", iconName: "GiPlainCircle", color: "rgba(255,255,255,0.95)", property: `${group}_icon${n}` };
    onChange([...icons, icon]);
    setPicked(icon.id);
  };
  const card = {
    w: "68px", h: "68px", p: "4px", borderWidth: "1px", borderRadius: "md", cursor: "pointer",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px",
    bg: "bg.subtle", _hover: { bg: "bg.muted" },
  };
  return (
    <Stack gap="8px">
      <Flex wrap="wrap" gap="6px">
        {icons.map((icon) => (
          <Box
            as="button" type="button" key={icon.id} {...card}
            aria-label={`Icon: ${icon.label}`} aria-pressed={icon.id === picked} title={icon.property}
            borderColor={icon.id === picked ? "colorPalette.solid" : "border"} colorPalette="blue"
            onClick={() => setPicked(icon.id === picked ? null : icon.id)}
          >
            <DynamicIcon iconPack={icon.iconPack} iconName={icon.iconName} iconProps={{ size: 28, color: icon.color }} />
            <Text fontSize="10px" lineClamp={1} maxW="100%">{icon.label}</Text>
          </Box>
        ))}
        <Box as="button" type="button" {...card} borderStyle="dashed" aria-label="Add icon" onClick={add}>
          <FaPlus />
          <Text fontSize="10px">Add icon</Text>
        </Box>
      </Flex>
      {!current && <Text fontSize="xs" color="fg.muted">Pick an icon to change it.</Text>}
      {current && (
        <Box role="group" aria-label={`Icon settings: ${current.label}`} borderWidth="1px" borderRadius="md" p="6px">
          <Table.Root size="sm">
            <Table.Body>
              <FieldRow label="Label"><Input size="xs" aria-label="Label" value={current.label ?? ""} onChange={(e) => change({ label: e.target.value })} /></FieldRow>
              <FieldRow label="Id"><Input size="xs" aria-label="Id" value={current.id ?? ""} onChange={(e) => change({ id: e.target.value })} /></FieldRow>
              <FieldRow label="Property"><Input size="xs" aria-label="Property" value={current.property ?? ""} onChange={(e) => change({ property: e.target.value })} /></FieldRow>
              <FieldRow label="Colour"><ColorField label="Colour" value={current.color} onChange={(color) => change({ color })} /></FieldRow>
              <FieldRow label="Icon"><IconField iconPack={current.iconPack} iconName={current.iconName} onChange={change} /></FieldRow>
            </Table.Body>
          </Table.Root>
          <Flex justify="flex-end" mt="4px">
            <Button size="2xs" variant="outline" colorPalette="red" onClick={() => { onChange(icons.filter((i) => i.id !== picked)); setPicked(null); }}>
              Remove icon
            </Button>
          </Flex>
        </Box>
      )}
    </Stack>
  );
}

// ── Part-specific editors ────────────────────────────────────────────────────

function ClickAction({ value, onChange }) {
  const kind = value?.Action !== undefined ? "action" : JSON.stringify(value) === JSON.stringify(OPEN_CARD) ? "card" : "custom";
  return (
    <>
      <FieldRow label="On click">
        <NativeSelect.Root size="xs">
          <NativeSelect.Field aria-label="On click" value={kind}
            onChange={(e) => onChange(e.target.value === "card" ? structuredClone(OPEN_CARD) : e.target.value === "action" ? { Action: "" } : value)}>
            <option value="card">Open the card</option>
            <option value="action">Run an action</option>
            {kind === "custom" && <option value="custom">Other (edit in the JSON)</option>}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </FieldRow>
      {kind === "action" && (
        <FieldRow label="Action name">
          <Input size="xs" aria-label="Action name" placeholder="myaddon/attack" value={value.Action} onChange={(e) => onChange({ ...value, Action: e.target.value })} />
        </FieldRow>
      )}
    </>
  );
}

function Extra({ kind, part, set }) {
  const p = part.params;
  switch (kind) {
    case "barColours":
      return (
        <WideRow>
          <Text fontSize="xs" mb="4px">Colours (in % of max; the last also above max)</Text>
          <Rows items={p.colors} columns={[["upTo", "Up to %", "number"], ["color", "Colour", "color"]]} addLabel="Add step"
            make={(items) => ({ upTo: 100, color: items.at(-1)?.color ?? "rgba(50,200,50,0.9)" })} onChange={(colors) => colors.length && set({ colors })} />
        </WideRow>
      );
    case "ringColours":
      return p.property ? (
        <WideRow>
          <Text fontSize="xs" mb="4px">Colour per value of {p.property}</Text>
          <Rows items={Object.entries(p.colors).map(([value, color]) => ({ value, color }))} addLabel="Add colour"
            columns={[["value", "Value", "text"], ["color", "Colour", "color"]]} make={() => ({ value: "", color: "#ffffff" })}
            onChange={(rows) => set({ colors: Object.fromEntries(rows.map((r) => [r.value, r.color])) })} />
        </WideRow>
      ) : null;
    case "icons":
      return <WideRow><IconCards icons={p.icons} group={p.name ?? p.group} onChange={(icons) => set({ icons })} /></WideRow>;
    case "click":
      return <ClickAction value={p.onClick} onChange={(onClick) => set({ onClick })} />;
    default:
      return null;
  }
}

const atLeast = (key, value) => (LEAST[key] && !(value >= LEAST[key][0]) ? LEAST[key][1] : value);

// Values of the switch select that no switch key can be (keys are letters, digits and _).
const kindOf = (part) => (part.pattern === "custom" ? "Custom" : PATTERNS[part.pattern].title);

const ALWAYS = "-none-";
const NEW = "-new-";

// The part's visibility switch: one Visible / GM only / Hidden setting in a game's map and
// token settings, for every part on it. Or none: always shown.
function SwitchRow({ part, groups, onMove }) {
  const key = part.params ? part.params.group : part.additions[0]?.tokenData?.maskGroup;
  return (
    <FieldRow label="Visibility switch">
      <NativeSelect.Root size="xs">
        <NativeSelect.Field aria-label="Visibility switch" value={key || ALWAYS}
          onChange={(e) => onMove(e.target.value === ALWAYS ? null : e.target.value === NEW ? "" : e.target.value)}>
          <option value={ALWAYS}>Always shown</option>
          {groups.map((g) => <option key={g.key} value={g.key}>{g.label} ({g.key})</option>)}
          <option value={NEW}>New switch…</option>
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </FieldRow>
  );
}

// The part's own name: the stem of its additions' names. Written when the field is left
// (or on Enter), so the box isn't rebuilt while it's typed.
function NameRow({ part, taken, onRename }) {
  const name = nameOfPart(part);
  const [draft, setDraft] = React.useState(null);
  const [problem, setProblem] = React.useState(null);
  const commit = () => {
    const next = draft?.trim();
    if (draft === null || next === name) return setDraft(null);
    if (!next) return setProblem("A part needs a name.");
    if (taken(next)) return setProblem(`"${next}" is already used by another part.`);
    setProblem(null);
    setDraft(null);
    onRename(next);
  };
  return (
    <FieldRow label="Name">
      <Stack gap="2px">
        <Input size="xs" aria-label="Name" value={draft ?? name ?? ""}
          onChange={(e) => { setDraft(e.target.value); setProblem(null); }}
          onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />
        {problem && <Text fontSize="xs" color="fg.error">{problem}</Text>}
        <Text fontSize="xs" color="fg.muted">Its additions are named after it: actions or addon code that find them by name need the new name.</Text>
      </Stack>
    </FieldRow>
  );
}

function PartRows({ part, groups, taken, onMove, onRename }) {
  return (
    <>
      <Section title="Part" />
      <NameRow part={part} taken={taken} onRename={onRename} />
      <SwitchRow part={part} groups={groups} onMove={onMove} />
    </>
  );
}

function PatternSettings({ part, onChange, ...rows }) {
  const p = part.params;
  const set = (patch) => onChange(updatePart(part, { ...p, ...patch }));
  const sections = [...SECTIONS[part.pattern], ...("anchor" in p ? [PLACEMENT] : [])];
  return (
    <Table.Root size="sm" mt="4px">
      <Table.Body>
        <PartRows part={part} {...rows} />
        {sections.map(([title, fields, extra]) => (
          <React.Fragment key={title}>
            <Section title={title} />
            {fields.map((field) => (
              <FieldRow key={field.key} label={field.label}>
                <Control field={field} value={p[field.key]} params={p}
                  onChange={(v) => set(field.kind === "icon" ? v : { [field.key]: atLeast(field.key, v) })} />
              </FieldRow>
            ))}
            {extra && <Extra kind={extra} part={part} set={set} />}
          </React.Fragment>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

// The object properties a part's rules are offered to set (any other can be typed).
const PART_TARGETS = ["opacity", "fill", "stroke", "strokeWidth", "angle", "scaleX", "scaleY", "visible", "text", "fontSize", "width", "height"];

// The part's own rules: what its pattern doesn't set (that's shown locked). A custom part's
// are the ones all its additions share; the others stay in the JSON.
function PartRules({ part, onChange }) {
  const locked = (PATTERNS[part.pattern]?.writes ?? []).map((target) => ({ target, by: kindOf(part) }));
  const rules = part.rules ?? [];
  const others = new Set(part.additions.flatMap((a) => (a.tokenData?.propDeps ?? []).map((d) => JSON.stringify(d))));
  for (const r of rules) others.delete(JSON.stringify(r));
  if (part.params) for (const a of part.additions) for (const d of a.tokenData?.propDeps ?? []) if ((PATTERNS[part.pattern].writes ?? []).includes(d.objectProperty)) others.delete(JSON.stringify(d));
  return (
    <Stack gap="4px" mt="6px">
      <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase">Rules</Text>
      <Text fontSize="xs" color="fg.muted">Each sets a property of the part from a game property, live. Try them with Sample values.</Text>
      {others.size > 0 && (
        <Text fontSize="xs" color="fg.muted">{others.size === 1 ? "1 more rule" : `${others.size} more rules`} on some of its additions only: edit {others.size === 1 ? "it" : "them"} in the JSON.</Text>
      )}
      <RulesEditor rules={rules} locked={locked} targets={PART_TARGETS} onChange={(deps) => onChange(setPartRules(part, deps))} />
    </Stack>
  );
}

// ── The list ─────────────────────────────────────────────────────────────────

// By the part's first addition: unique, and kept when the part is edited (a switch can be
// on several parts, so its key isn't).
const keyOf = (part, i) => part.additions[0]?.name ?? `part-${i}`;
const titleOf = (part) => `${kindOf(part)}: ${nameOfPart(part)}`;
const switchOf = (part, groups) => {
  const key = part.params ? part.params.group : part.additions[0]?.tokenData?.maskGroup;
  return key ? groups.find((g) => g.key === key)?.label ?? key : null;
};

export function PartsPanel({ definition, onChange }) {
  const { base, parts } = React.useMemo(() => splitParts(definition), [definition]);
  const [open, setOpen] = React.useState(() => new Set());

  const save = (next) => onChange(joinParts(base, next));
  const groups = React.useMemo(() => groupsOf(parts), [parts]);
  // Parts with the same title are numbered.
  const titles = [];
  for (const part of parts) {
    const title = titleOf(part);
    const n = titles.filter((t) => t === title || t.startsWith(`${title} (`)).length;
    titles.push(n ? `${title} (${n + 1})` : title);
  }
  const replace = (i, part) => save(parts.map((p, j) => (j === i ? part : p)));
  const move = (i, by) => {
    const next = [...parts];
    const [part] = next.splice(i, 1);
    next.splice(i + by, 0, part);
    save(next);
  };
  const toggle = (key) => setOpen((s) => {
    const next = new Set(s);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  // A name another part has, or that one of its additions' names starts with.
  const takenBy = (i) => (name) => parts.some((p, j) => j !== i
    && (nameOfPart(p) === name || p.additions.some((a) => a.name === name || a.name?.startsWith(`${name}_`))));
  const rename = (i, name) => {
    const next = renamePart(parts[i], name);
    // The box is keyed by its first addition's name: keep it open under the new one.
    const [was, now] = [keyOf(parts[i], i), keyOf(next, i)];
    if (open.has(was)) setOpen((s) => new Set([...s].map((k) => (k === was ? now : k))));
    replace(i, next);
  };

  if (!parts.length) return <Text fontSize="xs" color="fg.muted">No parts yet: add some with +.</Text>;
  return (
    <Stack gap="6px">
      {parts.map((part, i) => {
        const key = keyOf(part, i);
        const expanded = open.has(key);
        const custom = part.pattern === "custom";
        const rows = { groups, taken: takenBy(i), onMove: (k) => save(movePartToGroup(parts, i, k)), onRename: (name) => rename(i, name) };
        const onSwitch = switchOf(part, groups);
        return (
          <Box key={key} role="group" aria-label={titles[i]} borderWidth="1px" borderRadius="md" p="4px 6px" bg="bg.subtle">
            <Flex gap="4px" align="center">
              <IconButton size="2xs" variant="ghost" aria-label={expanded ? "Hide settings" : "Show settings"} aria-expanded={expanded}
                onClick={() => toggle(key)}>
                {expanded ? <FaChevronDown /> : <FaChevronRight />}
              </IconButton>
              <Text fontSize="sm" fontWeight="medium" flex="1" lineClamp={1}>{nameOfPart(part)}</Text>
              <Badge size="xs" variant="outline" title={onSwitch ? "Visibility switch" : "On no visibility switch"}>{onSwitch ?? "always shown"}</Badge>
              <Badge size="xs" variant="surface">{kindOf(part)}</Badge>
              <IconButton size="2xs" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><FaArrowUp /></IconButton>
              <IconButton size="2xs" variant="ghost" aria-label="Move down" disabled={i === parts.length - 1} onClick={() => move(i, 1)}><FaArrowDown /></IconButton>
              <IconButton size="2xs" variant="ghost" aria-label="Remove" onClick={() => save(parts.filter((_, j) => j !== i))}><FaTimes /></IconButton>
            </Flex>
            {custom && <Text fontSize="xs" color="fg.muted" pl="28px">Not a pattern the editor knows: change its settings in the JSON.</Text>}
            {expanded && custom && (
              <Table.Root size="sm" mt="4px"><Table.Body><PartRows part={part} {...rows} /></Table.Body></Table.Root>
            )}
            {expanded && !custom && <PatternSettings part={part} onChange={(next) => replace(i, next)} {...rows} />}
            {expanded && <PartRules part={part} onChange={(next) => replace(i, next)} />}
          </Box>
        );
      })}
    </Stack>
  );
}

export default PartsPanel;
