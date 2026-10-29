import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import { Box, Flex, Text, IconButton } from "@chakra-ui/react";
import { FaPlus } from "@react-icons/all-files/fa/FaPlus";
import { FaTimes } from "@react-icons/all-files/fa/FaTimes";
import { getTabsSnapshot, subscribeTabs, activateTab, closeTab, setTabTitle } from "./mobileTabs";
import { panelLook } from "./mobileCatalog";
import { makePanelContentContext } from "../../../helpers/panelContentContext";
import AddTabDialog from "./AddTabDialog";
import { AboutDialog } from "../../AboutDialog";
import { useToolbarCommands } from "../../uiComponents/base/DDItems/toolbarButtonsStore";
import ClientMediator from "../../../ClientMediator";
import themeColors from "../../../helpers/themeColors";
import "../../../stylesheets/mobile.css";

// One tab's panel. Visited tabs stay mounted (hidden) so chat, sheets and maps keep
// their state, as they do in the dock's background tabs.
const MobileTabContent = React.memo(({ tab, active, w, h }) => {
  // The dock's panel object: effects key on it, so it stays the same for the tab's life.
  const panel = React.useRef({ floating: false, mobileTab: true }).current;
  const ctx = React.useMemo(
    () => makePanelContentContext({
      w,
      h,
      contentId: tab.id,
      element: tab.element,
      panel,
      setTitle: (title) => setTabTitle(tab.id, title),
    }),
    [w, h, tab.id, tab.element, panel],
  );

  return (
    <Box className="nm_mobileTabContent" data-panel-key={tab.panelKey} display={active ? "flex" : "none"}>
      <Dockable.ContentContext.Provider value={ctx}>{tab.element}</Dockable.ContentContext.Provider>
    </Box>
  );
});

function TabCard({ tab, active }) {
  const look = panelLook(tab.panelKey);
  const Icon = look.icon;
  const title = tab.title || look.name;
  return (
    <Flex
      className="nm_mobileTabCard"
      data-active={active || undefined}
      borderColor={active ? themeColors.accent : "transparent"}
      bg={active ? themeColors.surfaceRaised : "transparent"}
    >
      <button
        type="button"
        role="tab"
        aria-selected={active}
        className="nm_mobileTabCardButton"
        onClick={() => activateTab(tab.id)}
      >
        <Icon aria-hidden="true" />
        <Text as="span" className="nm_mobileTabCardTitle">{title}</Text>
      </button>
      {active && (
        <IconButton
          aria-label={`Close ${title}`}
          size="2xs"
          variant="ghost"
          onClick={() => closeTab(tab.id)}
        >
          <FaTimes />
        </IconButton>
      )}
    </Flex>
  );
}

/**
 * The game UI on a phone: one full-screen panel at a time, a bottom bar of open tabs and
 * a + that opens the panel picker. Takes the place of the main toolbar and the dock.
 */
export function MobileShell({ state, gameDataManagerRef }) {
  const { tabs, activeId } = React.useSyncExternalStore(subscribeTabs, getTabsSnapshot);
  const [adding, setAdding] = React.useState(false);
  const openAboutRef = React.useRef();

  // Addons' toolbar buttons have no toolbar here: they're listed in the + sheet.
  useToolbarCommands("mobile-toolbar");

  // The panels' size (the battle map fits its canvas to it).
  const contentRef = React.useRef(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  React.useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return undefined;
    const measure = () => setSize((prev) =>
      prev.w === el.clientWidth && prev.h === el.clientHeight ? prev : { w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Keep the active card in view when a panel opens from elsewhere.
  const barRef = React.useRef(null);
  React.useEffect(() => {
    barRef.current?.querySelector("[data-active]")?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeId]);

  // A battle map tab brought to the front is the map the player is looking at (tools,
  // token placement and point requests act on it), as pressing its canvas does on desktop.
  const activeTab = tabs.find((tab) => tab.id === activeId);
  const activeMapId = activeTab?.panelKey === "Battlemap" ? activeTab.element?.props?.withID : undefined;
  React.useEffect(() => {
    if (activeMapId) ClientMediator.fireEvent("ActivePanelChanged", { panel: "BattleMap", contextId: activeMapId });
  }, [activeMapId]);

  return (
    <Flex className="nm_mobileShell" direction="column" minHeight={0} overflow="hidden">
      <Box ref={contentRef} className="nm_mobileContent" bg={themeColors.background}>
        {tabs.map((tab) => (
          <MobileTabContent key={tab.id} tab={tab} active={tab.id === activeId} w={size.w} h={size.h} />
        ))}
        {tabs.length === 0 && (
          <Flex className="nm_mobileEmpty" direction="column" align="center" justify="center" gap={3} color={themeColors.textMuted}>
            <Text>No panels open.</Text>
            <Text fontSize="sm">Tap + to open chat, dice, cards or a battle map.</Text>
          </Flex>
        )}
      </Box>
      <Flex className="nm_mobileTabBar" bg={themeColors.toolbar} borderColor={themeColors.border}>
        <Flex ref={barRef} role="tablist" className="nm_mobileTabList">
          {tabs.map((tab) => <TabCard key={tab.id} tab={tab} active={tab.id === activeId} />)}
        </Flex>
        <IconButton aria-label="Add a tab" className="nm_mobileAddButton" variant="outline" onClick={() => setAdding(true)}>
          <FaPlus />
        </IconButton>
      </Flex>
      <AddTabDialog
        open={adding}
        onClose={() => setAdding(false)}
        state={state}
        gameDataManagerRef={gameDataManagerRef}
        onAbout={() => openAboutRef.current?.()}
      />
      <AboutDialog openRef={openAboutRef} />
    </Flex>
  );
}

export default MobileShell;
