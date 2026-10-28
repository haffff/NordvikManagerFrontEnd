import * as React from "react";
import { Box, HStack, Text } from "@chakra-ui/react";
import { MaterialChooser } from "../../uiComponents/MaterialChooser";
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

/** An ordered list of CSS materials: later ones override earlier ones. */
export const StylesheetPicker = ({ value, onChange }) => (
  <Box className="nm_stylesheetPicker">
    {value.length === 0 && (
      <Text fontSize="xs" color="fg.muted" mb={2}>No stylesheets — the default look.</Text>
    )}
    <MaterialChooser
      multipleSelection
      orderable
      additionalFilter={isCssMaterial}
      materialsSelected={value}
      onSelect={onChange}
    />
  </Box>
);

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
      <StylesheetPicker value={value} onChange={save} />
      <Hint />
    </Box>
  );
};

/** A player's own stylesheets for this game — only they see them, kept in this browser. */
export const PersonalStylesheetSettings = ({ gameId }) => {
  const [value, setValue] = React.useState(() => getPersonalStylesheets(gameId));

  const save = (ids) => {
    setValue(ids);
    setPersonalStylesheets(gameId, ids);
    window.dispatchEvent(new Event(PERSONAL_STYLESHEETS_CHANGED));
  };

  return (
    <Box p={2}>
      <Title>My stylesheets (only I see them, on this browser)</Title>
      <StylesheetPicker value={value} onChange={save} />
      <Hint />
    </Box>
  );
};
