import * as React from "react";
import {
  Flex,
  Heading,
  Stack,
} from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import { FaCheck, FaEdit, FaUserFriends, FaWrench } from "react-icons/fa";
import Subscribable from "../../uiComponents/base/Subscribable";
import { IoIosRemoveCircleOutline, IoMdRemove } from "react-icons/io";
import LayoutSettingsPanel from "../settings/LayoutSettingsPanel";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import WebSocketManagerInstance from "../WebSocketManager";
import BasePanel from "../../uiComponents/base/BasePanel";
import DListItem from "../../uiComponents/base/List/DListItem";
import DListItemButton from "../../uiComponents/base/List/ListItemDetails/DListItemButton";
import ClientMediator from "../../../ClientMediator";
import WebHelper from "../../../helpers/WebHelper";
import CollectionSyncer from "../../uiComponents/base/CollectionSyncer";
import DListItemsButtonContainer from "../../uiComponents/base/List/DListItemsButtonContainer";
import UtilityHelper from "../../../helpers/UtilityHelper";

export const LayoutsManagerPanel = ({ state }) => {
  const [clientLayouts, setClientLayouts] = React.useState(undefined);
  const [serverLayouts, setServerLayouts] = React.useState(undefined);
  const [gameContainerRef, setGameContainerRef] = React.useState(undefined);

  const [selectedLayout, setSelectedLayout] = React.useState(
    ClientMediator.sendCommand("Game", "GetLayout", {})
  );

  React.useEffect(() => {
    WebHelper.get("Battlemap/GetLayouts", setServerLayouts);
    const cid = UtilityHelper.GenerateUUID();
    ClientMediator.register({
      clientId: cid,
      panel: "LayoutsManagerPanel",
      onEvent: (event, data) => {
        if (event === "ClientLayoutsChanged") {
          setClientLayouts(JSON.parse(localStorage.getItem("Layouts")));
        }
      },
    });

    let layouts = localStorage.getItem("Layouts");
    if (!layouts) {
      layouts = "[]";
    }

    let layoutArr = JSON.parse(layouts);

    setClientLayouts(layoutArr);

    return () => {
      ClientMediator.unregister(cid);
    };
  }, []);

  const GenerateServerLayouts = () => {
    if (serverLayouts === undefined) {
      return [];
    }

    let layouts = serverLayouts.map((x) => {
      return (
        <DListItem
          isSelected={selectedLayout?.id && selectedLayout?.id === x?.id}
        >
          {x.name}
          <DListItemsButtonContainer>
            <DListItemButton
              label="Remove"
              color={"red"}
              icon={IoIosRemoveCircleOutline}
              onClick={() => {
                let cmd = CommandFactory.CreateLayoutRemoveCommand(x.id);
                WebSocketManagerInstance.Send(cmd);
              }}
            />
            <DListItemButton
              label="Settings"
              icon={FaWrench}
              onClick={() => {
                Dockable.spawnFloating(
                  state,
                  <LayoutSettingsPanel layout={x} />
                );
              }}
              colorScheme="alpha"
            />
            <DListItemButton
              label="Apply this layout"
              icon={FaCheck}
              onClick={() => {
                ClientMediator.sendCommand("Game", "SetLayout", x);
              }}
            />
            <DListItemButton
              label="Force onto other players"
              icon={FaUserFriends}
              onClick={() => {
                let cmd = CommandFactory.CreateLayoutForceCommand(x.id);
                WebSocketManagerInstance.Send(cmd);
              }}
            />
          </DListItemsButtonContainer>
        </DListItem>
      );
    });
    return layouts;
  };

  const GenerateClientLayouts = () => {
    if (clientLayouts === undefined) {
      return [];
    }

    let layouts = clientLayouts.map((x) => {
      return (
        <DListItem
          isSelected={selectedLayout?.uuid && selectedLayout?.uuid === x?.uuid}
        >
          {x.name}
          <Flex direction={"row-reverse"} flexGrow={1}>
            <DListItemButton
              label={"Remove"}
              onClick={() => {
                let layouts = localStorage.getItem("Layouts");
                let layoutArr = JSON.parse(layouts);
                let newArr = layoutArr.filter((y) => y.uuid !== x.uuid);
                localStorage.setItem("Layouts", JSON.stringify(newArr));
                setClientLayouts(newArr);
                ClientMediator.fireEvent("ClientLayoutsChanged", {});
              }}
              colorScheme="alpha"
              color={"red"}
              icon={IoIosRemoveCircleOutline}
            />
            <DListItemButton
              label={"Apply this layout"}
              onClick={() => {
                ClientMediator.sendCommand("Game", "SetLayout", x);
              }}
              colorScheme="alpha"
              icon={FaCheck}
            />
            <DListItemButton
              label={"Rename"}
              onClick={() => {
                let layouts = localStorage.getItem("Layouts");
                let layoutArr = JSON.parse(layouts);
                let layout = layoutArr.find((y) => y.uuid === x.uuid);
                layout.name = prompt("Enter new name", layout.name);
                localStorage.setItem("Layouts", JSON.stringify(layoutArr));
                setClientLayouts(layoutArr);
                ClientMediator.fireEvent("ClientLayoutsChanged", {});
              }}
              colorScheme="alpha"
              icon={FaEdit}
            />
          </Flex>
        </DListItem>
      );
    });
    return layouts;
  };

  const ctx = Dockable.useContentContext();
  ctx.setTitle(`Layouts Manager`);

  return (
    <BasePanel>
      <Heading margin={"15px"}>Game layouts</Heading>
      <Stack>{GenerateServerLayouts()}</Stack>
      <Heading margin={"15px"}>Browser Layouts</Heading>
      <Stack>{GenerateClientLayouts()}</Stack>
      <CollectionSyncer
        collection={serverLayouts}
        setCollection={setServerLayouts}
        commandPrefix={"layout"}
      />
    </BasePanel>
  );
};
export default LayoutsManagerPanel;
