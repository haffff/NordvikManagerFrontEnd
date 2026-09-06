import * as React from "react";
import { FaMailBulk, FaTerminal, FaEye, FaBook, FaQuestion, FaFlask, FaCheck } from "react-icons/fa";
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
import { Button } from "@chakra-ui/react";

import { toaster } from "../../ui/toaster";

export const MainToolbar = ({
  Dockable,
  state,
  battlemapsRef,
  gameMethods,
  forceRefreshGame,
}) => {
  const [additionalButtons, setAdditionalButtons] = React.useState([]);
  const [experimentalEnabled, setExperimentalEnabled] = React.useState(
    () => localStorage.getItem('nm_experimental_enabled') === 'true'
  );

  const toggleExperimental = () => {
    setExperimentalEnabled(prev => {
      const next = !prev;
      localStorage.setItem('nm_experimental_enabled', next);
      return next;
    });
    // Force dockable re-render so Panel.js picks up the new localStorage value
    forceRefreshGame && forceRefreshGame('experimental');
  };

  React.useEffect(() => {
    ClientMediator.register({
      panel: "Toolbar",
      id: "main-toolbar",
      AddButton: (buttonData) => {
        let element;
        if (buttonData.menuId) {
          // Create a dropdown menu button so AddMenuItem steps can populate it
          element = React.createElement(DropDownMenu, {
            key: buttonData.menuId,
            viewId: buttonData.menuId,
            name: buttonData.menuName || buttonData.name,
          });
        } else {
          element = React.createElement(Button, {
            key: buttonData.name,
            height: "30px",
            size: "xs",
            borderRadius: 0,
            variant: "outline",
            onClick: buttonData.onClick,
          }, buttonData.name);
        }
        setAdditionalButtons(prev => [...prev, element]);
      },
    });
    return () => {
      ClientMediator.unregister("main-toolbar");
      setAdditionalButtons([]);
    };
  }, []);

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
      {additionalButtons}
      <DropDownMenu viewId={"experimental"} name={"Experimental"} width={100}>
        <DropDownItem
          key={'exp_toggle'}
          width={180}
          name={experimentalEnabled ? '⚡ Experimental: ON' : '○ Experimental: OFF'}
          onClick={toggleExperimental}
          icon={experimentalEnabled ? <FaCheck /> : <FaFlask />}
        />
        {experimentalEnabled && <>
        <DropDownItem
          key={'main_1'}
          width={180}
          name={'View'}
          onClick={() => { forceRefreshGame && forceRefreshGame('views') }}
          icon={<FaEye />}
        />
        <DropDownItem
          key={'main_2'}
          width={180}
          name={'Layouts'}
          onClick={() => { forceRefreshGame && forceRefreshGame('layouts') }}
          icon={<FaBook />}
        />
        <DropDownItem
          key={'main_3'}
          width={180}
          name={'Help'}
          onClick={() => { forceRefreshGame && forceRefreshGame('help') }}
          icon={<FaQuestion />}
        />
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
        </>}
      </DropDownMenu>
    </ToolBar>
  );
};
export default MainToolbar;
