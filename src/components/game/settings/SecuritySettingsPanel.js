import * as React from "react";
import { Flex, For, FormLabel, Heading } from "@chakra-ui/react";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import WebSocketManagerInstance from "../WebSocketManager";
import Subscribable from "../../uiComponents/base/Subscribable";
import Loadable from "../../uiComponents/base/Loadable";
import WebHelper from "../../../helpers/WebHelper";
import UtilityHelper from "../../../helpers/UtilityHelper";
import DList from "../../uiComponents/base/List/DList";
import DListItem from "../../uiComponents/base/List/DListItem";
import DButtonHorizontalContainer from "../../uiComponents/base/Containers/DButtonHorizontalContainer";
import DropDownButton from "../../uiComponents/base/DDItems/DropDrownButton";
import useGame from "../../uiComponents/hooks/useGameHook";
import ClientMediator from "../../../ClientMediator";
import {
  SelectRoot,
  SelectTrigger,
  SelectValueText,
  SelectContent,
  SelectItem,
} from "../../ui/select";
import { createListCollection } from "@chakra-ui/react";

export const SecuritySettingsPanel = ({ dto, type }) => {
  const [players, setPlayers] = React.useState(undefined);
  const [currentPlayerId, setCurrentPlayerId] = React.useState(null);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  const game = useGame();

  React.useEffect(() => {
    ClientMediator.sendCommandWaitForRegister(
      "Game",
      "GetPlayers",
      {},
      true
    ).then(setPlayers);
    ClientMediator.sendCommandWaitForRegister(
      "Game",
      "GetCurrentPlayer",
      {},
      true
    ).then(({ id }) => setCurrentPlayerId(id));
  }, []);

  if (!game || !players) {
    return <></>;
  }

  const Load = (finished) => {
    WebHelper.get(
      `security/permissions?gameId=${game.id}&entityId=${dto.id}&entityType=${type}`,
      (permissions) => {
        let loaclPlayers = structuredClone(players);

        loaclPlayers.forEach((player) => {
          let permission = permissions[player.id];
          if (permission === undefined) {
            permission = -1;
          }
          player.permission = permission;
        });
        loaclPlayers.push({
          id: UtilityHelper.EmptyGuid,
          name: "All",
          permission: permissions[UtilityHelper.EmptyGuid],
        });

        setPlayers(loaclPlayers);
        finished();
      }
    );
  };

  const predefinedRoles = createListCollection({
    items: [
      {
        name: "Not set",
        value: -1,
        description: "Permission has not been set",
      },
      { name: "None", value: 0, description: "Permission has not been set" },
      { name: "See", value: 1, description: "User can see this element" },
      {
        name: "Control",
        value: 4,
        description:
          "User can control/execute things in element(This doesn't include edit nor remove!)",
      },
      {
        name: "Edit",
        value: 7,
        description:
          "User can Edit things in element(This doesn't include removing!)",
      },
      {
        name: "All",
        value: 31,
        description: "User has full control over element",
      },
    ],
  });

  const preparePanel = (player) => {
    return (
      <DListItem padding={"10px"} isSelected={player.id === currentPlayerId}>
        <Heading size={"xs"} width="40%">
          {player.name}
        </Heading>
        <Flex width={"60%"} grow={1} direction={"row-reverse"}>
          <SelectRoot
            value={[player.permission]}
            collection={predefinedRoles}
            onValueChange={(x) => {
              player.permission = x.value[0];
              forceUpdate();
            }}
            size="sm"
          >
            <SelectTrigger>
              <SelectValueText placeholder="Select permission">
                {(items) => {
                  const { name } = items[0];
                  return (
                      <>{name}</>
                  );
                }}
              </SelectValueText>
            </SelectTrigger>
            <SelectContent>
              <For each={predefinedRoles.items}>
                {(x) => (
                  <SelectItem item={x} key={x.value}>
                    {x.name}
                  </SelectItem>
                )}
              </For>
            </SelectContent>
          </SelectRoot>
        </Flex>
      </DListItem>
    );
  };

  const HandleEdit = () => {
    let newPermissions = {};
    players.forEach((element) => {
      let permission = parseInt(element.permission);
      newPermissions[element.id] = permission;
    });

    let cmd = CommandFactory.CreateUpdatePermissionsCommand(
      dto.id,
      type,
      newPermissions
    );
    WebSocketManagerInstance.Send(cmd);
  };

  const HandleIncomingUpdate = (cmd) => {
    if (cmd.data["id"] == dto.id) {
      let newPlayers = structuredClone(players);
      newPlayers.forEach((player) => {
        let permission = cmd.data["permissions"][player.id];
        if (permission === undefined) {
          permission = -1;
        }
        player.permission = permission;
      });
      setPlayers(newPlayers);
    }
  };

  return (
    <Loadable OnLoad={Load}>
      <Subscribable
        commandPrefix={"permissions_update"}
        onMessage={HandleIncomingUpdate}
      />
      <DList>{players.map((x) => preparePanel(x))}</DList>
      <DButtonHorizontalContainer>
        <DropDownButton
          width={200}
          name={"Save"}
          onClick={() => HandleEdit()}
        />
      </DButtonHorizontalContainer>
    </Loadable>
  );
};
export default SecuritySettingsPanel;
