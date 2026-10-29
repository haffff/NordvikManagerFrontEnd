import * as React from "react";
import { FaMailBulk } from "@react-icons/all-files/fa/FaMailBulk";
import { FaTerminal } from "@react-icons/all-files/fa/FaTerminal";
import { FaQuestionCircle } from "@react-icons/all-files/fa/FaQuestionCircle";
import { FaInfoCircle } from "@react-icons/all-files/fa/FaInfoCircle";
import { DropDownItem } from "../../uiComponents/base/DDItems/DropDownItem";
import { DropDownMenu } from "../../uiComponents/base/DDItems/DropDownMenu";
import ToolBar from "./ToolBar";
import SettingsMenu from "./ToolBarMenus/SettingsMenu";
import ViewsMenu from "./ToolBarMenus/ViewsMenu";
import LayoutsMenu from "./ToolBarMenus/LayoutsMenu";
import { IoIosExit } from "@react-icons/all-files/io/IoIosExit";
import UtilityHelper from "../../../helpers/UtilityHelper";
import AddonsMenu from "./ToolBarMenus/AddonsMenu";
import ClientMediator from "../../../ClientMediator";
import { usePermissions } from "../../../contexts/PermissionsContext";
import { Button } from "@chakra-ui/react";

import { toaster } from "../../ui/toaster";
import { AboutDialog } from "../../AboutDialog";
import { getToolbarButtons, subscribeToolbarButtons, useToolbarCommands } from "../../uiComponents/base/DDItems/toolbarButtonsStore";

export const MainToolbar = ({
  Dockable,
  state,
  battlemapsRef,
  gameMethods,
  forceRefreshGame,
}) => {
  const openAboutRef = React.useRef();

  useToolbarCommands("main-toolbar");
  const toolbarButtons = React.useSyncExternalStore(subscribeToolbarButtons, getToolbarButtons);
  const additionalButtons = toolbarButtons.map((button) =>
    // A menu button: AddMenuItem steps fill it through its viewId.
    button.menuId
      ? <DropDownMenu key={button.key} viewId={button.menuId} name={button.name} />
      : (
        <Button key={button.key} height="30px" size="xs" borderRadius={0} variant="outline" onClick={button.onClick}>
          {button.name}
        </Button>
      )
  );

  const GenerateInviteLink = () => {
    let game = ClientMediator.sendCommand("Game", "GetGame", {});
    const centralServerUrl = process.env.REACT_APP_CENTRAL_URL;
    let url =
      `${centralServerUrl}/client?game=${game.centralSessionId}` +
      (game.requirePassword ? `&rp=1` : "");
    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(url);
    } else {
      window.prompt("Copy to clipboard: Ctrl+C, Enter", url);
    }
    toaster.create(UtilityHelper.GenerateCopiedToast());
  };

  // Whether the player may create/overwrite layouts. Whoever may edit the game always can;
  // otherwise the per-game "disallowPlayerLayouts" toggle decides. Read from the init
  // snapshot, so a change mid-session takes effect for players on their next reload.
  const { canEditGame } = usePermissions();
  const gameSnapshot = ClientMediator.sendCommand("Game", "GetGame", {});
  const canSaveLayouts = canEditGame || !gameSnapshot?.disallowPlayerLayouts;

  return (
    <ToolBar>
      <DropDownMenu viewId={"game"} name={"Game"} width={100}>
        <DropDownItem
          requiresEdit
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
          name={"Show tutorial"}
          icon={<FaQuestionCircle />}
          onClick={() => ClientMediator.sendCommand("Tutorial", "Start")}
        />
        <DropDownItem
          width={150}
          name={"About"}
          icon={<FaInfoCircle />}
          onClick={() => openAboutRef.current()}
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
        canSave={canSaveLayouts}
      />
      <AddonsMenu state={state} />
      {additionalButtons}
      <AboutDialog openRef={openAboutRef} />
    </ToolBar>
  );
};
export default MainToolbar;
