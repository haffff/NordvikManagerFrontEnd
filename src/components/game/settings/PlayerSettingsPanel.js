import * as React from "react";
import {
  HStack,
  Button,
  Box,
  Stack,
  Textarea,
  Grid,
  GridItem,
  Flex,
  Card,
  CardHeader,
  CardBody,
  Heading,
  Center,
  Badge,
  FormLabel,
  Input,
  Checkbox,
  NumberInput,
  NumberInputField,
} from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import SettingsPanel from "./SettingsPanel";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import WebSocketManagerInstance from "../WebSocketManager";
import Subscribable from "../../uiComponents/base/Subscribable";
import ClientMediator from "../../../ClientMediator";

export const PlayerSettingsPanel = ({ player }) => {
  const [playerData, setPlayerData] = React.useState(player);

  const editables = [
    { key: "name", label: "Name", toolTip: "Name of player.", type: "string" },
    {
      key: "image",
      label: "Avatar",
      toolTip: "Image of player.",
      type: "image",
    },
    {
      key: "color",
      label: "Color",
      toolTip: "Color of player.",
      type: "color",
    },
  ];

  const ctx = Dockable.useContentContext();
  ctx.setTitle(`Player settings`);

  ctx.setPreferredSize(600, 800);

  const sendSettingsUpdate = (dtoToSend) => {
    dtoToSend.id = playerData.id;
    let command = CommandFactory.CreatePlayerSettingsCommand(dtoToSend);
    WebSocketManagerInstance.Send(command);
  };

  const updateSettings = (event) => {
    if (playerData.id !== event.data.id) {
      return;
    }
    setPlayerData({ ...playerData, ...event.data });
  };

  React.useEffect(() => {
    const GetData = async () => {
      const newPlayer = await ClientMediator.sendCommandWaitForRegisterAsync(
        "Game",
        "GetPlayer",
        { id: player.id },
        true
      );
      setPlayerData(newPlayer);
    };

    GetData();
  }, [player]);

  return (
    <Subscribable commandPrefix={"settings_player"} onMessage={updateSettings}>
      <SettingsPanel
        dto={playerData}
        editableKeyLabelDict={editables}
        onSave={sendSettingsUpdate}
        normalize={true}
      />
    </Subscribable>
  );
};
export default PlayerSettingsPanel;
