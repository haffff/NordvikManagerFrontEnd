import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import { Box, Flex, NativeSelect, Input, Stack, Text } from "@chakra-ui/react";
import { BasePanel } from "../../components/uiComponents/base/BasePanel";
import { JsonEditor } from "../../components/uiComponents/JsonEditor";
import { Switch } from "../../components/ui/switch";
import { TokenPreview } from "../TokenPreview";
import { Stamper } from "../stamper/Stamper";
import { PartsPanel } from "../PartsPanel";
import { AddPartMenu } from "../AddPartMenu";
import { QuickEditFieldsPanel } from "../QuickEditFieldsPanel";
import { VisibilitySwitchesPanel } from "../VisibilitySwitchesPanel";
import { PATTERNS } from "../patterns";
import { addPatternAt, movePart, freePlace } from "../dragDrop";
import { collectTokenProperties } from "../collectTokenProperties";
import { validateToken } from "../validateToken";
import { useEditor } from "../editorStore";
import { RulesEditor } from "../rules/RulesEditor";

// The token editor's dock panels. Each is a game panel body (BasePanel) in a Dockable
// tab, reading and changing the one shared editor state, so they can be docked anywhere.

/** The tab's title and the size the panel asks for when docked. */
function useDockTitle(title, width, height) {
  const ctx = Dockable.useContentContext();
  React.useEffect(() => {
    ctx?.setTitle(title);
    if (width) ctx?.setPreferredSize(width, height ?? 400);
    // ctx is a new object each render; title and size are what matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, width, height]);
}

const body = { direction: "column", height: "100%", overflowY: "auto", padding: "8px", gap: "8px" };
const row = { display: "flex", gap: "6px", alignItems: "center", fontSize: "12px" };

// Where a pattern's parts usually go (a ring always goes around the token).
const usualPlace = (pattern) => {
  const { anchor, offsetX, offsetY } = PATTERNS[pattern].create({ group: pattern });
  return { anchor, offsetX, offsetY };
};

export function PartsView() {
  useDockTitle("Parts", 380);
  const [{ definition }, { edit }] = useEditor();
  return (
    <BasePanel {...body} helpText="The token's parts: add one with +, open one to change its settings (its name, its visibility switch, how it looks), or drag a + entry onto the preview.">
      <Flex align="center" gap="8px">
        <AddPartMenu onAdd={(pattern) => edit(addPatternAt(definition, pattern, freePlace(definition, usualPlace(pattern))))} />
        <Text fontSize="xs" color="fg.muted">Add a part, or drag one from the menu onto the preview.</Text>
      </Flex>
      <PartsPanel definition={definition} onChange={edit} />
    </BasePanel>
  );
}

export function QuickEditFieldsView() {
  useDockTitle("Quick-edit fields", 380);
  const [{ definition }, { edit }] = useEditor();
  return (
    <BasePanel {...body} helpText="The fields behind the gear next to a selected token (editableProps): each reads and writes one property of the token or its card. Turn on Selected in the preview to try them.">
      <QuickEditFieldsPanel definition={definition} onChange={edit} />
    </BasePanel>
  );
}

export function VisibilitySwitchesView() {
  useDockTitle("Visibility switches", 380);
  const [{ definition, values }, { edit, setValue }] = useEditor();
  return (
    <BasePanel {...body} helpText="Visibility switches: each is one setting a GM flips in a game's map and token settings to show, make GM-only or hide every part on it. A part picks its switch (or none: always shown) in its settings in Parts. Try a setting out here: the preview follows it.">
      <VisibilitySwitchesPanel definition={definition} onChange={edit} values={values} onValue={setValue} />
    </BasePanel>
  );
}

function SwitchRow({ label, checked, onChange }) {
  return <Switch size="sm" checked={checked} onCheckedChange={({ checked: value }) => onChange(value)} inputProps={{ "aria-label": label }}>{label}</Switch>;
}

export function PreviewView() {
  useDockTitle("Preview");
  const [s, { setView, edit, addLog, setError, setValue }] = useEditor();
  return (
    <BasePanel {...body} alignItems="center" helpText="The token as a game draws it, with the sample values. Selected shows the game's quick-edit and icon-picker buttons on it; Arrange parts lets you drag parts around.">
      <Flex gap="12px" wrap="wrap" align="center" justify="center" alignSelf="stretch">
        <label style={row}>
          Size
          <NativeSelect.Root size="xs" width="72px">
            <NativeSelect.Field value={s.size} onChange={(e) => setView({ size: Number(e.target.value) })} aria-label="Size in squares">
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}×{n}</option>)}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </label>
        <label style={row}>
          Grid
          <Input size="xs" width="64px" type="number" min="10" max="300" value={s.gridSize} aria-label="Grid size in pixels"
            onChange={(e) => setView({ gridSize: Number(e.target.value) || 50 })} />
        </label>
        <SwitchRow label="View as GM" checked={s.isGM} onChange={(isGM) => setView({ isGM })} />
        <SwitchRow label="Selected" checked={s.selected} onChange={(selected) => setView({ selected })} />
        <SwitchRow label="Arrange parts" checked={s.arrange} onChange={(arrange) => setView({ arrange })} />
      </Flex>
      <Flex flex="1" align="center" justify="center" minH="0">
        <TokenPreview
          definition={s.definition} values={s.values} gridSize={s.gridSize} size={s.size} isGM={s.isGM}
          selected={s.selected || s.arrange} imageKey={s.imageKey} width={440} height={440}
          arrange={s.arrange}
          onMovePart={(name, placement) => edit(movePart(s.definition, name, placement))}
          onDropPattern={(pattern, placement) => edit(addPatternAt(s.definition, pattern, placement))}
          onEvent={addLog}
          onProperty={setValue}
          onError={(err) => setError(String(err?.message ?? err))}
        />
      </Flex>
      {s.arrange && <Text fontSize="xs" color="fg.muted">Drag parts on the preview; they snap to the nearest corner, edge or centre.</Text>}
      {s.log.length > 0 && (
        <Box fontSize="12px" fontFamily="monospace" w="440px" maxW="100%" maxH="120px" overflowY="auto" color="fg.muted" aria-label="Clicks">
          {s.log.map((line, i) => <div key={i}>{line}</div>)}
        </Box>
      )}
    </BasePanel>
  );
}

function SampleValue({ prop, value, onChange }) {
  const id = `sample-${prop.source}-${prop.name}`;
  return (
    <label htmlFor={id} style={row}>
      {prop.kind === "bool" ? (
        <input id={id} type="checkbox" checked={value === "true"} onChange={(e) => onChange(e.target.checked ? "true" : "false")} />
      ) : (
        <Input id={id} size="xs" type={prop.kind === "number" ? "number" : "text"} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
          width={prop.kind === "number" ? "72px" : "140px"} />
      )}
      <span>{prop.name}</span>
      <Text as="span" color="fg.muted" fontSize="11px">{prop.source}</Text>
    </label>
  );
}

export function SampleValuesView() {
  useDockTitle("Sample values", 380);
  const [{ definition, values }, { setValue }] = useEditor();
  const properties = React.useMemo(() => collectTokenProperties(definition), [definition]);
  return (
    <BasePanel {...body} gap="4px" helpText="Values for the properties the token reads, as its card and the token itself would have them in a game.">
      {properties.length === 0 && <Text fontSize="13px" color="fg.muted">This token reads no properties.</Text>}
      {properties.map((prop) => (
        <SampleValue key={`${prop.source}:${prop.name}`} prop={prop} value={values[prop.source]?.[prop.name]} onChange={(v) => setValue(prop.source, prop.name, v)} />
      ))}
    </BasePanel>
  );
}

// The game's JSON editor (an element's Direct Edit): a tree with search, or the text.
// It reads its value only when it mounts, so a change made elsewhere (a part added, a
// part dragged, a file opened) opens it again on the new file; its own edits don't.
function TokenJsonEditor() {
  const [{ definition }, { edit }] = useEditor();
  const fromEditor = React.useRef(null);
  const shown = React.useRef(definition);
  const [revision, setRevision] = React.useState(0);
  React.useEffect(() => {
    if (definition === shown.current) return;
    shown.current = definition;
    if (definition !== fromEditor.current) setRevision((r) => r + 1);
  }, [definition]);
  const onChange = (value) => {
    // Emptied, or not an object: not a token file (the editor shows text that doesn't parse).
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    fromEditor.current = value;
    edit(value);
  };
  return (
    // The wrapper is 65vh tall for Direct Edit's tab; here it fills the dock panel.
    <Flex flex="1" minH="240px" direction="column" css={{ "& .nm_json_editor_wrapper": { height: "auto", flex: 1, minHeight: 0 } }}>
      <JsonEditor key={revision} value={definition} onChange={onChange} />
    </Flex>
  );
}

export function TokenFileView() {
  useDockTitle("Token file", 380);
  const [{ error, definition }] = useEditor();
  const problems = React.useMemo(() => validateToken(definition), [definition]);
  return (
    <BasePanel {...body} helpText="The token file itself, in the game's JSON editor: a tree you can search, or the text (the mode menu). Edits redraw the preview; the file is checked against the token schema.">
      <TokenJsonEditor />
      {error && <Text color="fg.error" fontSize="13px" role="alert">{error}</Text>}
      {!error && problems.length > 0 && (
        <Box as="ul" aria-label="Schema problems" fontSize="12px" color="fg.warning" pl="16px" maxH="160px" overflowY="auto" style={{ listStyle: "disc" }}>
          {problems.slice(0, 20).map((p, i) => (
            <li key={i}>{p.part ? `${p.part}: ` : ""}{p.path.replace(/^\/additions\/\d+/, "") || "/"} {p.message}</li>
          ))}
          {problems.length > 20 && <li>…and {problems.length - 20} more</li>}
        </Box>
      )}
      {!error && problems.length === 0 && <Text fontSize="12px" color="fg.muted">Matches the token schema.</Text>}
    </BasePanel>
  );
}

// The token picture's own rules (root tokenData.propDeps); its src is the game's.
const PICTURE_TARGETS = ["opacity", "angle", "scaleX", "scaleY", "visible"];

/** The file with these picture rules: none at all when there are none. */
function withPictureRules(definition, deps) {
  const { propDeps, ...rest } = definition.tokenData ?? {};
  const tokenData = deps.length ? { ...rest, propDeps: deps } : rest;
  const { tokenData: _old, ...file } = definition;
  return Object.keys(tokenData).length ? { ...file, tokenData } : file;
}

export function PictureView() {
  useDockTitle("Picture", 380);
  const [{ definition }, { setPicture, edit }] = useEditor();
  return (
    <BasePanel {...body} helpText="The token's picture: pick one, or make a round one with the stamper. Nothing is uploaded. Its rules set the picture's own properties (e.g. opacity) from game properties.">
      <Stack gap="10px">
        <label style={row}>
          Picture <input type="file" accept="image/*" aria-label="Choose picture" onChange={(e) => setPicture(e.target.files?.[0])} />
        </label>
        <Stamper onUse={(blob) => setPicture(blob)} />
        <Stack gap="4px">
          <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase">Picture rules</Text>
          <RulesEditor rules={definition.tokenData?.propDeps ?? []} targets={PICTURE_TARGETS}
            onChange={(deps) => edit(withPictureRules(definition, deps))} />
        </Stack>
      </Stack>
    </BasePanel>
  );
}
