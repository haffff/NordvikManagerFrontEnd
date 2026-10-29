import * as React from "react";
import { Box, Flex, Heading, IconButton, Text } from "@chakra-ui/react";
import { FaTimes } from "@react-icons/all-files/fa/FaTimes";
import { FaMap } from "@react-icons/all-files/fa/FaMap";
import { FaTerminal } from "@react-icons/all-files/fa/FaTerminal";
import { FaInfoCircle } from "@react-icons/all-files/fa/FaInfoCircle";
import { IoIosExit } from "@react-icons/all-files/io/IoIosExit";
import { MOBILE_SECTIONS } from "./mobileCatalog";
import { addonCommandSections } from "./mobileCommands";
import { getMenuItems, subscribeMenuItems } from "../../uiComponents/base/DDItems/menuItemsStore";
import { getToolbarButtons, subscribeToolbarButtons } from "../../uiComponents/base/DDItems/toolbarButtonsStore";
import ClientMediator from "../../../ClientMediator";
import { openTab } from "./mobileTabs";
import { usePermissions } from "../../../contexts/PermissionsContext";
import { ActiveWebHelper as WebHelper } from "../../../helpers/transport";
import Battlemap from "../../BattleMap/Battlemap";
import themeColors from "../../../helpers/themeColors";

function EntryCard({ name, Icon, onClick }) {
  return (
    <button type="button" className="nm_mobileAddCard" onClick={onClick} aria-label={name}>
      <Box as="span" color={themeColors.accentText} fontSize="xl"><Icon aria-hidden="true" /></Box>
      <Text as="span" fontSize="sm">{name}</Text>
    </button>
  );
}

// An addon's menu item or toolbar button: a command, so a row rather than a panel card.
function CommandRow({ name, onClick }) {
  return (
    <button type="button" className="nm_mobileCommandRow" onClick={onClick}>
      <Text as="span" fontSize="sm">{name}</Text>
    </button>
  );
}

/**
 * The mobile "+": a full-screen sheet of everything that can open as a tab — the
 * toolbar's menus, and the battle maps this player may see — and, since the phone has no
 * toolbar, the game's commands and what addons added to the toolbar.
 */
export function AddTabDialog({ open, onClose, state, gameDataManagerRef, onAbout }) {
  const { canEditGame } = usePermissions();
  const toolbarButtons = React.useSyncExternalStore(subscribeToolbarButtons, getToolbarButtons);
  // The menu item store has a snapshot per menu, not one for all: re-render on any change,
  // so an item added while the sheet is open shows up.
  const [, menuItemsChanged] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => subscribeMenuItems(menuItemsChanged), []);
  const [battleMaps, setBattleMaps] = React.useState([]);

  // Fresh each time it opens: maps come and go during a session. The server lists only
  // the battle maps this player can see.
  React.useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    WebHelper.getAsync("battleMap/getBattleMaps")
      .then((maps) => { if (!cancelled) setBattleMaps(Array.isArray(maps) ? maps : []); })
      .catch(() => { if (!cancelled) setBattleMaps([]); });
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  const add = (element) => {
    openTab(element);
    onClose();
  };

  const run = (command) => {
    onClose();
    command();
  };

  const gameCommands = [
    { key: "run", name: "Run command", icon: FaTerminal, onClick: () => ClientMediator.sendCommand("game", "OpenRun") },
    { key: "about", name: "About", icon: FaInfoCircle, onClick: () => onAbout?.() },
    { key: "exit", name: "Exit game", icon: IoIosExit, onClick: () => ClientMediator.sendCommand("game", "Exit") },
  ];
  const addonSections = addonCommandSections({ getItems: getMenuItems, toolbarButtons, canEditGame });

  const sections = MOBILE_SECTIONS
    .map((section) => ({ ...section, entries: section.entries.filter((e) => !e.requiresEdit || canEditGame) }))
    .filter((section) => section.entries.length > 0);

  return (
    <Box className="nm_mobileAddDialog" role="dialog" aria-label="Open a panel" bg={themeColors.background}>
      <Flex align="center" justify="space-between" mb={3}>
        <Heading size="md">Open a panel</Heading>
        <IconButton aria-label="Close" variant="ghost" onClick={onClose}><FaTimes /></IconButton>
      </Flex>
      {battleMaps.length > 0 && (
        <section>
          <Heading size="xs" color={themeColors.textMuted} mb={2}>Battle maps</Heading>
          <div className="nm_mobileAddGrid">
            {battleMaps.map((bm) => (
              <EntryCard key={bm.id} name={bm.name} Icon={FaMap} onClick={() => add(<Battlemap withID={bm.id} />)} />
            ))}
          </div>
        </section>
      )}
      {sections.map((section) => (
        <section key={section.name}>
          <Heading size="xs" color={themeColors.textMuted} mb={2}>{section.name}</Heading>
          <div className="nm_mobileAddGrid">
            {section.entries.map((entry) => (
              <EntryCard
                key={entry.key}
                name={entry.name}
                Icon={entry.icon}
                onClick={() => add(entry.create({ state, gameDataManagerRef }))}
              />
            ))}
          </div>
        </section>
      ))}
      {addonSections.map((section) => (
        <section key={section.key}>
          <Heading size="xs" color={themeColors.textMuted} mb={2}>{section.title}</Heading>
          <div className="nm_mobileCommandList">
            {section.items.map((item) => (
              <CommandRow key={item.key} name={item.name} onClick={() => run(item.onClick)} />
            ))}
          </div>
        </section>
      ))}
      <section>
        <Heading size="xs" color={themeColors.textMuted} mb={2}>Game</Heading>
        <div className="nm_mobileAddGrid">
          {gameCommands.map((command) => (
            <EntryCard key={command.key} name={command.name} Icon={command.icon} onClick={() => run(command.onClick)} />
          ))}
        </div>
      </section>
    </Box>
  );
}

export default AddTabDialog;
