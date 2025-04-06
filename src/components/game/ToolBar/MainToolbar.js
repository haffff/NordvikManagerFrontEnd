import { FaCode, FaMailBulk, FaMailchimp, FaTerminal } from "react-icons/fa";
import { DropDownItem } from "../../uiComponents/base/DDItems/DropDownItem";
import { DropDownMenu } from "../../uiComponents/base/DDItems/DropDownMenu";
import ToolBar from "./ToolBar";
import SettingsMenu from "./ToolBarMenus/SettingsMenu";
import ViewsMenu from "./ToolBarMenus/ViewsMenu";
import LayoutsMenu from "./ToolBarMenus/LayoutsMenu";
import { IoIosExit } from "react-icons/io";
import UtilityHelper from "../../../helpers/UtilityHelper";
import AddonsMenu from "./ToolBarMenus/AddonsMenu";
import ClientMediator from "../../../ClientMediator";
import {
  MenuContent,
  MenuContextTrigger,
  MenuItem,
  MenuRoot,
} from "../../ui/menu";

import { toaster } from "../../ui/toaster";

export const MainToolbar = ({
  Dockable,
  state,
  battlemapsRef,
  gameMethods,
  forceRefreshGame,
}) => {
  const GenerateInviteLink = () => {
    let game = ClientMediator.sendCommand("Game", "GetGame", {});
    let url =
      `${window.location.origin}?iid=${game.id}` +
      (game.requirePassword
        ? `&rp=${game.requirePassword}`
        : "");
    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(url);
    } else {
      window.prompt("Copy to clipboard: Ctrl+C, Enter", url);
    }
    toaster.create(UtilityHelper.GenerateCopiedToast());
  };

  return (
    <ToolBar>
      <DropDownMenu viewId={"game"} name={"Game"} width={100}>
        <DropDownItem
          gmOnly
          width={150}
          name={"Get Invite URL"}
          onClick={GenerateInviteLink}
          icon={<FaMailBulk />}
        />
        <DropDownItem
          width={150}
          name={"Run command"}
          icon={<FaTerminal />}
          onClick={() => ClientMediator.sendCommand("game", "OpenRun")}
        />
        <DropDownItem
          width={150}
          name={"Exit"}
          icon={<IoIosExit />}
          onClick={() => ClientMediator.sendCommand("game", "Exit")}
        />
      </DropDownMenu>
      <ViewsMenu
        gameMethods={gameMethods}
        state={state}
        battlemapsRef={battlemapsRef}
        onDropDown={forceRefreshGame}
      />
      <SettingsMenu
        battlemapsRef={battlemapsRef}
        state={state}
      />
      <LayoutsMenu
        gameMethods={gameMethods}
        state={state}
        battlemapsRef={battlemapsRef}
      />
      <AddonsMenu state={state} />
      <DropDownMenu viewId={"experimental"} name={"Experimental"} width={100}>
        <DropDownItem
          width={150}
          name={"Chat (Window)"}
          state={state}
          onClick={() => {
            ClientMediator.sendCommand("Game", "CreateNewPanel", {
              type: "ChatPanel",
              inWindow: true,
            });
          }}
        />
      </DropDownMenu>
    </ToolBar>
  );
};
export default MainToolbar;
