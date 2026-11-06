import * as React from "react";
import { FaDiceD20 } from "@react-icons/all-files/fa/FaDiceD20";
import { FaListOl } from "@react-icons/all-files/fa/FaListOl";
import { FaMusic } from "@react-icons/all-files/fa/FaMusic";
import { FaPaintBrush } from "@react-icons/all-files/fa/FaPaintBrush";
import { FaUserAlt } from "@react-icons/all-files/fa/FaUserAlt";
import { FaUserCog } from "@react-icons/all-files/fa/FaUserCog";
import { FaUserFriends } from "@react-icons/all-files/fa/FaUserFriends";
import { FaVolumeUp } from "@react-icons/all-files/fa/FaVolumeUp";
import { FaWrench } from "@react-icons/all-files/fa/FaWrench";
import { FaUser } from "@react-icons/all-files/fa/FaUser";
import { FaHammer } from "@react-icons/all-files/fa/FaHammer";
import { FaCode } from "@react-icons/all-files/fa/FaCode";
import { FaList } from "@react-icons/all-files/fa/FaList";
import { FaMap } from "@react-icons/all-files/fa/FaMap";
import { FaIdCard } from "@react-icons/all-files/fa/FaIdCard";
import { FaRegWindowMaximize } from "@react-icons/all-files/fa/FaRegWindowMaximize";
import { IoMdChatboxes } from "@react-icons/all-files/io/IoMdChatboxes";
import { IoMdDocument } from "@react-icons/all-files/io/IoMdDocument";
import { IoMdFolder } from "@react-icons/all-files/io/IoMdFolder";
import ChatPanel from "../panels/ChatPanel";
import DiceRollerPanel from "../panels/DiceRollerPanel";
import TurnOrderPanel from "../panels/TurnOrderPanel";
import CardsPanel from "../panels/CardsPanel";
import PlayersPanel from "../panels/PlayersPanel";
import MaterialsPanel from "../panels/MaterialsPanel";
import PlaylistsPanel from "../panels/PlaylistsPanel";
import SoundboardPanel from "../panels/SoundboardPanel";
import AdminPlayersPanel from "../panels/AdminPlayersPanel";
import GameSettingsPanel from "../settings/GameSettingsPanel";
import PlayerSettingsPanel from "../settings/PlayerSettingsPanel";
import AddonsManagePanel from "../panels/Addons/AddonsManagePanel";
import CustomViewsPanel from "../panels/Addons/CustomViewsPanel";
import TemplatesPanel from "../panels/Addons/TemplatesPanel";
import ActionsPanel from "../panels/Addons/ActionsPanel";
import DebugConsolePanel from "../panels/Addons/DebugConsolePanel";
import EventLogPanel from "../panels/Addons/EventLogPanel";

// What the mobile "+" dialog offers: the toolbar's View, Settings and Addons menus,
// grouped. `key` is the panel's PanelsList key (it also picks the tab's icon and
// default title); requiresEdit entries are for GMs, as in the menus.
// Layouts, pop-out and keyboard shortcuts have no place on a phone; the map tools are
// a button on each battle map tab (MapToolsButton).
export const MOBILE_SECTIONS = [
  {
    name: "Play",
    entries: [
      { key: "ChatPanel", name: "Chat", icon: IoMdChatboxes, create: () => <ChatPanel /> },
      { key: "DiceRollerPanel", name: "Dice", icon: FaDiceD20, create: () => <DiceRollerPanel /> },
      { key: "TurnOrderPanel", name: "Turn order", icon: FaListOl, create: () => <TurnOrderPanel /> },
      { key: "CardsPanel", name: "Cards", icon: FaUserAlt, create: ({ state }) => <CardsPanel state={state} /> },
      { key: "PlayersPanel", name: "Players", icon: FaUserFriends, create: () => <PlayersPanel /> },
      { key: "MaterialsPanel", name: "Materials", icon: FaPaintBrush, create: ({ state }) => <MaterialsPanel state={state} /> },
    ],
  },
  {
    name: "Game master",
    entries: [
      { key: "PlaylistsPanel", name: "Playlists", icon: FaMusic, requiresEdit: true, create: ({ state }) => <PlaylistsPanel state={state} /> },
      { key: "SoundboardPanel", name: "Soundboard", icon: FaVolumeUp, requiresEdit: true, create: ({ state }) => <SoundboardPanel state={state} /> },
      { key: "AdminPlayersPanel", name: "Manage players", icon: FaUserCog, requiresEdit: true, create: ({ state }) => <AdminPlayersPanel state={state} /> },
      { key: "GameSettingsPanel", name: "Game settings", icon: FaWrench, requiresEdit: true, create: () => <GameSettingsPanel /> },
    ],
  },
  {
    name: "Addons",
    entries: [
      { key: "AddonsManagePanel", name: "Addons", icon: IoMdDocument, requiresEdit: true, create: ({ gameDataManagerRef }) => <AddonsManagePanel gameDataRef={gameDataManagerRef} /> },
      { key: "CustomViewsPanel", name: "Views manager", icon: IoMdFolder, requiresEdit: true, create: ({ state, gameDataManagerRef }) => <CustomViewsPanel state={state} gameDataRef={gameDataManagerRef} /> },
      { key: "TemplatesPanel", name: "Templates", icon: IoMdFolder, requiresEdit: true, create: ({ state, gameDataManagerRef }) => <TemplatesPanel state={state} gameDataRef={gameDataManagerRef} /> },
      { key: "ActionsPanel", name: "Actions", icon: FaHammer, requiresEdit: true, create: ({ state, gameDataManagerRef }) => <ActionsPanel state={state} gameDataRef={gameDataManagerRef} /> },
      { key: "DebugConsolePanel", name: "Debug console", icon: FaCode, requiresEdit: true, create: ({ state }) => <DebugConsolePanel state={state} /> },
      { key: "EventLogPanel", name: "Event log", icon: FaList, requiresEdit: true, create: ({ state }) => <EventLogPanel state={state} /> },
    ],
  },
  {
    name: "Settings",
    entries: [
      { key: "PlayerSettingsPanel", name: "Player settings", icon: FaUser, create: () => <PlayerSettingsPanel /> },
    ],
  },
];

const byKey = new Map(MOBILE_SECTIONS.flatMap((section) => section.entries.map((entry) => [entry.key, entry])));

// Panels opened from elsewhere (a card, a battle map, a setting) that aren't in the dialog.
const OTHER_PANELS = {
  Battlemap: { name: "Battle map", icon: FaMap },
  CardPanel: { name: "Card", icon: FaIdCard },
};

/** The icon and default title of a tab showing the panel `panelKey`. */
export function panelLook(panelKey) {
  const entry = byKey.get(panelKey) ?? OTHER_PANELS[panelKey];
  return { name: entry?.name ?? panelKey ?? "Panel", icon: entry?.icon ?? FaRegWindowMaximize };
}
