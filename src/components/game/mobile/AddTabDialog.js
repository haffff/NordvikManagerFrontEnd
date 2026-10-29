import * as React from "react";
import { Box, Flex, Heading, IconButton, Text } from "@chakra-ui/react";
import { FaTimes } from "@react-icons/all-files/fa/FaTimes";
import { FaMap } from "@react-icons/all-files/fa/FaMap";
import { MOBILE_SECTIONS } from "./mobileCatalog";
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

/**
 * The mobile "+": a full-screen sheet of everything that can open as a tab — the
 * toolbar's menus, and the battle maps this player may see.
 */
export function AddTabDialog({ open, onClose, state, gameDataManagerRef }) {
  const { canEditGame } = usePermissions();
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
    </Box>
  );
}

export default AddTabDialog;
