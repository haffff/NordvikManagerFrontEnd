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
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import DListItem from "../../uiComponents/base/List/DListItem";
import DListItemButton from "../../uiComponents/base/List/ListItemDetails/DListItemButton";
import ClientMediator from "../../../ClientMediator";
import { ActiveWebHelper as WebHelper } from "../../../helpers/transport";
import CollectionSyncer from "../../uiComponents/base/CollectionSyncer";
import DListItemsButtonContainer from "../../uiComponents/base/List/DListItemsButtonContainer";
import UtilityHelper from "../../../helpers/UtilityHelper";
import { toaster } from "../../ui/toaster";

export const LayoutsManagerPanel = ({ state }) => {
  const [serverLayouts, setServerLayouts] = React.useState(undefined);

  const [selectedLayout, setSelectedLayout] = React.useState();

  React.useEffect(() => {
    WebHelper.get("Battlemap/GetLayouts", setServerLayouts);
    const current = ClientMediator.sendCommand("Game", "GetLayout");
    if (current) setSelectedLayout(current);
  }, []);

  const applyLayout = (x) => {
    ClientMediator.sendCommand("Game", "SetLayout", x.id);
    setSelectedLayout(x);
    toaster.create({ title: "Layout applied", type: "success", duration: 5000 });
  };

  const GenerateServerLayouts = () => {
    if (serverLayouts === undefined) return [];

    return serverLayouts.map((x) => (
      <DListItem
        key={x.id}
        isSelected={selectedLayout?.id === x?.id}
      >
        {x.name}
        <DListItemsButtonContainer>
          <DListItemButton
            label="Remove"
            color={"red"}
            icon={IoIosRemoveCircleOutline}
            onClick={() => {
              WebSocketManagerInstance.Send(CommandFactory.CreateLayoutRemoveCommand(x.id));
            }}
          />
          <DListItemButton
            label="Settings"
            icon={FaWrench}
            colorScheme="alpha"
            onClick={() => {
              Dockable.spawnFloating(state, <LayoutSettingsPanel layoutId={x.id} />);
            }}
          />
          <DListItemButton
            label="Apply this layout"
            icon={FaCheck}
            onClick={() => applyLayout(x)}
          />
          <DListItemButton
            label="Force onto other players"
            icon={FaUserFriends}
            onClick={() => {
              WebSocketManagerInstance.Send(CommandFactory.CreateLayoutForceCommand(x.id));
              toaster.create({ title: "Layout forced", type: "success", duration: 5000 });
            }}
          />
        </DListItemsButtonContainer>
      </DListItem>
    ));
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
