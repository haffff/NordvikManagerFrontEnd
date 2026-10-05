import * as React from "react";
import { Box, Button, HStack, Icon, NativeSelect, Text } from "@chakra-ui/react";
import { IoMdAdd } from "react-icons/io";
import { ActiveWebHelper as WebHelper, ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import { toaster } from "../../ui/toaster";
import { HelpIcon } from "../../uiComponents/base/HelpIcon";
import {
  DISABLE_STYLES_PARAM,
  GAME_STYLESHEETS_PROPERTY,
  getPersonalStylesheets,
  parseStylesheetList,
  setPersonalStylesheets,
} from "../../../helpers/customStyles";
import { PERSONAL_STYLESHEETS_CHANGED } from "./GameStylesheets";

const isCssMaterial = (m) => m?.mimeType === "text/css" || /\.css$/i.test(m?.name ?? "");

// The game's CSS materials, for picking.
function useCssMaterials() {
  const [materials, setMaterials] = React.useState([]);
  React.useEffect(() => {
    let cancelled = false;
    WebHelper.getAsync("materials/getresources")
      .then((all) => { if (!cancelled) setMaterials((all ?? []).filter(isCssMaterial)); })
      .catch((e) => console.warn("StylesheetSettings: couldn't list materials", e));
    return () => { cancelled = true; };
  }, []);
  return materials;
}

/** An ordered list of CSS materials: later ones override earlier ones. */
export const StylesheetPicker = ({ value, onChange, materials }) => {
  const [toAdd, setToAdd] = React.useState("");
  const byId = React.useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);
  const available = materials.filter((m) => !value.includes(m.id));
  const addId = toAdd && available.some((m) => m.id === toAdd) ? toAdd : available[0]?.id ?? "";

  const move = (index, delta) => {
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };

  return (
    <Box className="nm_stylesheetPicker">
      {value.length === 0 && (
        <Text fontSize="xs" color="fg.muted">No stylesheets — the default look.</Text>
      )}
      {value.map((id, index) => (
        <HStack key={id} gap={2} py="2px">
          <Text fontSize="xs" flex={1}>{byId.get(id)?.name ?? `Missing material (${id})`}</Text>
          <Button size="2xs" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up">↑</Button>
          <Button size="2xs" variant="ghost" disabled={index === value.length - 1} onClick={() => move(index, 1)} aria-label="Move down">↓</Button>
          <Button size="2xs" variant="ghost" onClick={() => onChange(value.filter((x) => x !== id))} aria-label="Remove">✕</Button>
        </HStack>
      ))}
      <HStack gap={2} mt={2}>
        <NativeSelect.Root size="xs" flex={1} disabled={available.length === 0}>
          <NativeSelect.Field value={addId} onChange={(e) => setToAdd(e.target.value)}>
            {available.length === 0 && <option value="">No other CSS materials — upload a .css file in Materials</option>}
            {available.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Button size="2xs" variant="outline" disabled={!addId} onClick={() => { onChange([...value, addId]); setToAdd(""); }}>
          <Icon as={IoMdAdd} mr={1} /> Add
        </Button>
      </HStack>
    </Box>
  );
};

const DOC_URL = "/user-guide/custom-styling";

const Title = ({ children }) => (
  <HStack gap="5px" mb={2}>
    <Text fontSize="sm">{children}</Text>
    <HelpIcon text="Variables and class names you can style, and what a stylesheet may load." docUrl={DOC_URL} />
  </HStack>
);

const Hint = () => (
  <Text fontSize="2xs" color="fg.muted" mt={2}>
    Stylesheets apply in order, later ones winning. Only data: URLs, this app and this game's own material URLs
    can be loaded from them. Add ?{DISABLE_STYLES_PARAM} to the page address to turn all custom styling off.
  </Text>
);

/** GM: the game's stylesheets, applied for every player. */
export const GameStylesheetSettings = ({ gameId }) => {
  const materials = useCssMaterials();
  const [property, setProperty] = React.useState(undefined); // undefined = loading, null = not set yet
  const [value, setValue] = React.useState([]);

  React.useEffect(() => {
    if (!gameId) return;
    WebHelper.getAsync(`properties/QueryProperties?parentIds=${gameId}&names=${GAME_STYLESHEETS_PROPERTY}`)
      .then((props) => {
        const prop = (props ?? []).find((p) => p?.name === GAME_STYLESHEETS_PROPERTY) ?? null;
        setProperty(prop);
        setValue(parseStylesheetList(prop?.value));
      })
      .catch(() => setProperty(null));
  }, [gameId]);

  // Sent over the websocket so the server re-broadcasts it and every
  // client's GameStylesheets applies it straight away.
  const save = (ids) => {
    setValue(ids);
    const json = JSON.stringify(ids);
    if (property) {
      const updated = { ...property, value: json };
      setProperty(updated);
      WebSocketManagerInstance.Send({ command: "property_update", data: updated });
    } else {
      WebSocketManagerInstance.Send({
        command: "property_add",
        data: { name: GAME_STYLESHEETS_PROPERTY, value: json, parentId: gameId, entityName: "GameModel" },
      });
      // Pick up the created property's id for the next change.
      setTimeout(() => {
        WebHelper.getAsync(`properties/QueryProperties?parentIds=${gameId}&names=${GAME_STYLESHEETS_PROPERTY}`)
          .then((props) => setProperty((props ?? []).find((p) => p?.name === GAME_STYLESHEETS_PROPERTY) ?? null));
      }, 500);
    }
    toaster.create({ description: "Game stylesheets updated", type: "success", duration: 3000 });
  };

  if (property === undefined) return null;
  return (
    <Box p={2}>
      <Title>Game stylesheets (every player)</Title>
      <StylesheetPicker value={value} onChange={save} materials={materials} />
      <Hint />
    </Box>
  );
};

/** A player's own stylesheets for this game — only they see them, kept in this browser. */
export const PersonalStylesheetSettings = ({ gameId }) => {
  const materials = useCssMaterials();
  const [value, setValue] = React.useState(() => getPersonalStylesheets(gameId));

  const save = (ids) => {
    setValue(ids);
    setPersonalStylesheets(gameId, ids);
    window.dispatchEvent(new Event(PERSONAL_STYLESHEETS_CHANGED));
  };

  return (
    <Box p={2}>
      <Title>My stylesheets (only I see them, on this browser)</Title>
      <StylesheetPicker value={value} onChange={save} materials={materials} />
      <Hint />
    </Box>
  );
};
