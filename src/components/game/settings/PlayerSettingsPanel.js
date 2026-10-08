import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import SettingsPanel from "./SettingsPanel";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import Subscribable from "../../uiComponents/base/Subscribable";
import ClientMediator from "../../../ClientMediator";
import { toaster } from "../../ui/toaster";
import { ActiveWebHelper as WebHelper } from "../../../helpers/transport";
import { PersonalStylesheetSettings } from "../theme/StylesheetSettings";
import ResourceCacheSettings from "./ResourceCacheSettings";
import AudioVolumeSettings from "./AudioVolumeSettings";

export const PlayerSettingsPanel = ({ player }) => {
  const [playerData, setPlayerData] = React.useState();

  const playerDataRef = React.useRef(playerData);
  playerDataRef.current = playerData;

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

  // Personal stylesheets, sound volumes and the offline cache live in this browser, so only your own player has them.
  const isCurrentPlayer = ClientMediator.sendCommand("Game", "GetCurrentPlayer")?.id === player?.id;

  const ctx = Dockable.useContentContext();
  ctx.setTitle(`Player settings`);

  ctx.setPreferredSize(600, 800);
  const sendSettingsUpdate = (dtoToSend) => {
    const cmd = CommandFactory.CreatePlayerSettingsCommand({
      ...dtoToSend,
      id: playerData.id,
    });
    WebSocketManagerInstance.Send(cmd);
  };

  const updateSettings = (event) => {
    if (playerDataRef.current.id !== event.data.id) {
      return;
    }
    setPlayerData({ ...playerDataRef.current, ...event.data });

    toaster.create({
      title: "Player settings updated",
      description: "Player settings updated successfully.",
      type: "success",
      duration: 5000,
      isClosable: true,
    });
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
      {isCurrentPlayer && <PersonalStylesheetSettings gameId={WebHelper.GameId} />}
      {isCurrentPlayer && <AudioVolumeSettings />}
      {isCurrentPlayer && <ResourceCacheSettings />}
    </Subscribable>
  );
};
export default PlayerSettingsPanel;
