import { FaCode, FaMap, FaMapSigns, FaTools, FaUser } from "react-icons/fa";
import ChatPanel from "../panels/ChatPanel";
import Battlemap, { BattleMapInstance } from "../Game";
import ToolsPanel from "../panels/ToolsPanel/ToolsPanel";
import { DropDownItem } from "../../uiComponents/base/DDItems/DropDownItem";
import { DropDownMenu } from "../../uiComponents/base/DDItems/DropDownMenu";
import ToolBar from "./ToolBar";
import SettingsMenu from "./ToolBarMenus/SettingsMenu";
import ViewsMenu from "./ToolBarMenus/ViewsMenu";
import LayoutsMenu from "./ToolBarMenus/LayoutsMenu";
import { IoIosExit } from "react-icons/io";
import { API } from "../../../CardAPI";
import { useToast } from "@chakra-ui/react";
import UtilityHelper from "../../../helpers/UtilityHelper";
import OnlyOwner from "../../uiComponents/base/OnlyOwner";
import AddonsMenu from "./ToolBarMenus/AddonsMenu";
import ClientMediator from "../../../ClientMediator";
import { GiRun } from "react-icons/gi";

export const MainToolbar = ({ Dockable,
    state,
    battlemapsRef,
    gameDataManagerRef,
    keyboardEventsManagerRef,
    gameMethods,
    forceRefreshGame,
}) => {
    const toast = useToast();

    let gameDataManager = gameDataManagerRef.current;

    const GenerateInviteLink = () => {
        let url = `${window.location.origin}?iid=${gameDataManager.Game.id}` + (gameDataManager.Game.requirePassword ? `&rp=${gameDataManager.Game.requirePassword}` : "");
        if (navigator && navigator.clipboard) {
            navigator.clipboard.writeText(url);
        } else {
            window.prompt("Copy to clipboard: Ctrl+C, Enter", url);
        }
        toast(UtilityHelper.GenerateCopiedToast());
    }

    if(!gameDataManagerRef)
    {
        return <>LOADING...</>;
    }

    return (
        <ToolBar>
            <DropDownMenu viewId={"game"} name={"Game"} width={100}>
                <DropDownItem gmOnly width={150} name={"Get Invite URL"} onClick={GenerateInviteLink} />
                <DropDownItem width={150} name={"Run command"} icon={FaCode} onClick={() => ClientMediator.sendCommand("game", "OpenRun")} />
                <DropDownItem width={150} name={"Exit"} icon={IoIosExit} onClick={() => ClientMediator.sendCommand("game", "Exit")} />
            </DropDownMenu>
            <ViewsMenu gameMethods={gameMethods} state={state} gameDataManagerRef={gameDataManagerRef} battlemapsRef={battlemapsRef} onDropDown={forceRefreshGame} />
            <SettingsMenu gameDataManagerRef={gameDataManagerRef} battlemapsRef={battlemapsRef} state={state} />
            <LayoutsMenu gameMethods={gameMethods} gameDataManagerRef={gameDataManagerRef} state={state} battlemapsRef={battlemapsRef} />
            <AddonsMenu gameDataManagerRef={gameDataManagerRef} state={state} />
        </ToolBar>
    );
}
export default MainToolbar;