import Battlemap from "../components/BattleMap/Battlemap";
import ActionsPanel from "../components/game/panels/Addons/ActionsPanel";
import AddonsManagePanel from "../components/game/panels/Addons/AddonsManagePanel";
import CustomViewsPanel from "../components/game/panels/Addons/CustomViewsPanel";
import DebugConsolePanel from "../components/game/panels/Addons/DebugConsolePanel";
import EventLogPanel from "../components/game/panels/Addons/EventLogPanel";
import LookupPanel from "../components/game/panels/Addons/LookupPanel";
import TemplatesPanel from "../components/game/panels/Addons/TemplatesPanel";
import AdminPlayersPanel from "../components/game/panels/AdminPlayersPanel";
import CardPanel from "../components/game/panels/CardPanel";
import CardsPanel from "../components/game/panels/CardsPanel";
import ChatPanel from "../components/game/panels/ChatPanel";
import LayoutsManagerPanel from "../components/game/panels/LayoutsManagerPanel";
import MapSelector from "../components/game/panels/MapSelector";
import PlayersPanel from "../components/game/panels/PlayersPanel";
import MaterialsPanel from "../components/game/panels/MaterialsPanel";
import PlaylistsPanel from "../components/game/panels/PlaylistsPanel";
import PropertiesPanel from "../components/game/panels/PropertiesPanel";
import SoundboardPanel from "../components/game/panels/SoundboardPanel";
import ToolsPanel from "../components/game/panels/ToolsPanel/ToolsPanel";
import CardSettingsPanel from "../components/game/settings/CardSettingsPanel";
import GameSettingsPanel from "../components/game/settings/GameSettingsPanel";
import LayoutSettingsPanel from "../components/game/settings/LayoutSettingsPanel";
import MapSettingsPanel from "../components/game/settings/MapSettingsPanel";
import PlayerSettingsPanel from "../components/game/settings/PlayerSettingsPanel";


export const PanelList = {
    ChatPanel: ChatPanel,
    Battlemap: Battlemap,
    ActionsPanel: ActionsPanel,
    AddonsManagePanel: AddonsManagePanel,
    CustomViewsPanel: CustomViewsPanel,
    DebugConsolePanel: DebugConsolePanel,
    EventLogPanel: EventLogPanel,
    LookupPanel: LookupPanel,
    TemplatesPanel: TemplatesPanel,
    ToolsPanel: ToolsPanel,
    AdminPlayersPanel: AdminPlayersPanel,
    CardPanel: CardPanel,
    CardsPanel: CardsPanel,
    MapSelector: MapSelector,
    LayoutsManagerPanel: LayoutsManagerPanel,
    PlayersPanel: PlayersPanel,
    PropertiesPanel: PropertiesPanel,
    MapSettingsPanel: MapSettingsPanel,
    GameSettingsPanel: GameSettingsPanel,
    PlayerSettingsPanel: PlayerSettingsPanel,
    LayoutSettingsPanel: LayoutSettingsPanel,
    CardSettingsPanel: CardSettingsPanel,
    MaterialsPanel: MaterialsPanel,
    PlaylistsPanel: PlaylistsPanel,
    SoundboardPanel: SoundboardPanel,
}

// Reverse lookup: rendered component type -> stable PanelList key. Used when
// serializing a layout so it survives production minification of function names
// (see LayoutCloneHelper.SetPanelKeyResolver). Handles React.memo / forwardRef
// wrappers, and falls back to the (possibly mangled) function name.
const componentToKey = new Map(Object.entries(PanelList).map(([k, v]) => [v, k]));

export const getPanelKeyForComponent = (elementType) => {
    if (!elementType) return undefined;
    return (
        componentToKey.get(elementType) ??
        componentToKey.get(elementType.type) ??   // React.memo(X)
        componentToKey.get(elementType.render) ??  // React.forwardRef(X)
        elementType.type?.name ??
        elementType.name
    );
};


export default PanelList;