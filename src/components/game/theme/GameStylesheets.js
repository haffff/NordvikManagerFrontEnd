import * as React from "react";
import { ActiveWebHelper as WebHelper, ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import UtilityHelper from "../../../helpers/UtilityHelper";
import {
  GAME_STYLESHEETS_PROPERTY,
  buildStyleSheet,
  customStylesDisabled,
  getPersonalStylesheets,
  invalidateCssMaterial,
  loadCssMaterial,
  parseStylesheetList,
} from "../../../helpers/customStyles";

// Fired on window when this player changes their own stylesheets (they live
// in this browser, so there's no server broadcast for them).
export const PERSONAL_STYLESHEETS_CHANGED = "nm-personal-stylesheets-changed";

/**
 * Loads the game's custom CSS into the page: the GM's stylesheets (game
 * property "customStylesheets", for everyone) first, then this player's own
 * (see helpers/customStyles.js), so a player's own rules win. Renders nothing.
 * Add ?nostyles to the URL to turn all of it off (a broken theme can't lock
 * anyone out).
 */
export const GameStylesheets = ({ gameId }) => {
  const [gmIds, setGmIds] = React.useState([]);
  const [personalIds, setPersonalIds] = React.useState(() => getPersonalStylesheets(gameId));
  const [reloadToken, setReloadToken] = React.useState(0);
  const disabled = React.useMemo(() => customStylesDisabled(), []);
  const idsRef = React.useRef([]);
  idsRef.current = [...gmIds, ...personalIds];

  // The GM's list, and this player's.
  React.useEffect(() => {
    if (!gameId || disabled) return;
    let cancelled = false;
    WebHelper.getAsync(`properties/QueryProperties?parentIds=${gameId}&names=${GAME_STYLESHEETS_PROPERTY}`)
      .then((props) => {
        if (cancelled) return;
        const prop = (props ?? []).find((p) => p?.name === GAME_STYLESHEETS_PROPERTY);
        setGmIds(parseStylesheetList(prop?.value));
      })
      .catch((e) => console.warn("GameStylesheets: couldn't load the game's stylesheets", e));
    setPersonalIds(getPersonalStylesheets(gameId));
    return () => { cancelled = true; };
  }, [gameId, disabled]);

  React.useEffect(() => {
    if (disabled) return;
    const onPersonal = () => setPersonalIds(getPersonalStylesheets(gameId));
    window.addEventListener(PERSONAL_STYLESHEETS_CHANGED, onPersonal);
    return () => window.removeEventListener(PERSONAL_STYLESHEETS_CHANGED, onPersonal);
  }, [gameId, disabled]);

  // Live updates: the GM changing the list, or a stylesheet material changing.
  React.useEffect(() => {
    if (!gameId || disabled) return;
    const subscriptionKey = "game_stylesheets_" + UtilityHelper.GenerateUUID();
    WebSocketManagerInstance.Subscribe(subscriptionKey, (event) => {
      const { command, data } = event ?? {};
      if (command === "property_add" || command === "property_update" || command === "property_remove") {
        if (data?.parentId !== gameId || data?.name !== GAME_STYLESHEETS_PROPERTY) return;
        setGmIds(command === "property_remove" ? [] : parseStylesheetList(data.value));
      } else if (command === "resource_update" || command === "resource_delete") {
        const id = typeof data === "string" ? data : data?.id;
        if (!id || !idsRef.current.includes(id)) return;
        invalidateCssMaterial(id);
        setReloadToken((n) => n + 1);
      }
    });
    return () => WebSocketManagerInstance.Unsubscribe(subscriptionKey);
  }, [gameId, disabled]);

  // Apply, in order. Ours are appended after any other adopted sheets.
  const appliedRef = React.useRef([]);
  React.useEffect(() => {
    if (disabled || typeof document === "undefined" || !("adoptedStyleSheets" in document)) return;
    let cancelled = false;
    const ids = [...gmIds, ...personalIds];
    Promise.all(ids.map((id) => loadCssMaterial({ id }))).then((texts) => {
      if (cancelled) return;
      const sheets = texts.map(buildStyleSheet).filter(Boolean);
      const others = document.adoptedStyleSheets.filter((s) => !appliedRef.current.includes(s));
      document.adoptedStyleSheets = [...others, ...sheets];
      appliedRef.current = sheets;
    });
    return () => { cancelled = true; };
  }, [gmIds, personalIds, reloadToken, disabled]);

  React.useEffect(() => () => {
    if (typeof document === "undefined" || !("adoptedStyleSheets" in document)) return;
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => !appliedRef.current.includes(s));
    appliedRef.current = [];
  }, []);

  return null;
};

export default GameStylesheets;
