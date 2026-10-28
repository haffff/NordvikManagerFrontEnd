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
import { Tabs } from "@chakra-ui/react";
import { BasePanel } from "../../uiComponents/base/BasePanel";

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

  // Without a player (Settings → Player, or restored from a saved layout, which drops
  // it) these are your own settings.
  const currentPlayerId = ClientMediator.sendCommand("Game", "GetCurrentPlayer")?.id;
  const playerId = player?.id ?? currentPlayerId;

  // Personal stylesheets, sound volumes and the offline cache live in this browser, so only your own player has them.
  const isCurrentPlayer = !!playerId && playerId === currentPlayerId;

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
        { id: playerId },
        true
      );
      setPlayerData(newPlayer);
    };

    if (playerId) GetData();
  }, [playerId]);

  return (
    <Subscribable commandPrefix={"settings_player"} onMessage={updateSettings}>
      {/* Tabs: the player form is full height (its Save button sits at the bottom),
          so anything placed under it was clipped out of view. */}
      <BasePanel>
        <Tabs.Root defaultValue="player" size="md" variant="enclosed" lazyMount height="100%" display="flex" flexDirection="column">
          <Tabs.List>
            <Tabs.Trigger value="player">Player</Tabs.Trigger>
            {isCurrentPlayer && <Tabs.Trigger value="browser">This browser</Tabs.Trigger>}
          </Tabs.List>
          <Tabs.Content value="player" flex="1" minHeight={0}>
            <SettingsPanel
              dto={playerData}
              editableKeyLabelDict={editables}
              onSave={sendSettingsUpdate}
              normalize={true}
            />
          </Tabs.Content>
          {isCurrentPlayer && (
            <Tabs.Content value="browser" flex="1" minHeight={0} overflowY="auto">
              <PersonalStylesheetSettings gameId={WebHelper.GameId} />
              <AudioVolumeSettings />
              <ResourceCacheSettings />
            </Tabs.Content>
          )}
        </Tabs.Root>
      </BasePanel>
    </Subscribable>
  );
};
export default PlayerSettingsPanel;
