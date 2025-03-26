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
import { toaster } from "../../ui/toaster";

export const LayoutsManagerPanel = ({ state }) => {
  const [serverLayouts, setServerLayouts] = React.useState(undefined);

  const [selectedLayout, setSelectedLayout] = React.useState();

  React.useEffect(() => {
    WebHelper.get("Battlemap/GetLayouts", setServerLayouts);
    let selectedLayout = ClientMediator.sendCommand("Game", "GetLayout");

    if (selectedLayout) {
      setSelectedLayout(selectedLayout);
    }

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
                  <LayoutSettingsPanel layoutId={x.id} />
                );
              }}
              colorScheme="alpha"
            />
            <DListItemButton
              label="Apply this layout"
              icon={FaCheck}
              onClick={() => {
                ClientMediator.sendCommand("Game", "SetLayout", x.id);
                toaster.create({title: "Layout applied", type: "success", duration: 5000});
              }}
            />
            <DListItemButton
              label="Force onto other players"
              icon={FaUserFriends}
              onClick={() => {
                let cmd = CommandFactory.CreateLayoutForceCommand(x.id);
                WebSocketManagerInstance.Send(cmd);

                toaster.create({title: "Layout forced", type: "success", duration: 5000});
              }}
            />
          </DListItemsButtonContainer>
        </DListItem>
      );
    });
    return layouts;
  };

  const ctx = Dockable.useContentContext();
  ctx.setTitle(`Layouts Manager`);

  return (
    <BasePanel>
      <Heading margin={"15px"}>Layouts</Heading>
      <Stack>{GenerateServerLayouts()}</Stack>
      <CollectionSyncer
        collection={serverLayouts}
        setCollection={setServerLayouts}
        commandPrefix={"layout"}
        incrementalUpdate={true}
      />
    </BasePanel>
  );
};
export default LayoutsManagerPanel;
