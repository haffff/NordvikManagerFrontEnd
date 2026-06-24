import * as React from "react";
import { Box, Flex, Icon, Spinner, Text } from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import { FaMap, FaWrench } from "react-icons/fa";
import { IoIosRemoveCircleOutline } from "react-icons/io";
import { MdCheckCircle } from "react-icons/md";
import { ActiveWebHelper as WebHelper } from "../../../helpers/transport";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import MapSettingsPanel from "../settings/MapSettingsPanel";
import DList from "../../uiComponents/base/List/DList";
import DListItem from "../../uiComponents/base/List/DListItem";
import DListItemButton from "../../uiComponents/base/List/ListItemDetails/DListItemButton";
import DListItemsButtonContainer from "../../uiComponents/base/List/DListItemsButtonContainer";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import ClientMediator from "../../../ClientMediator";
import useBMName from "../../uiComponents/hooks/useBattleMapName";
import CollectionSyncer from "../../uiComponents/base/CollectionSyncer";
import Subscribable from "../../uiComponents/base/Subscribable";

export const MapSelector = ({ battleMapId, state }) => {
  const [value, setValue] = React.useState(undefined);
  const [maps, setMaps] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const HandleSettings = (id) => {
    WebHelper.get(`map/get?mapId=${id}`, (r) => {
      Dockable.spawnFloating(state, <MapSettingsPanel map={r} />);
    });
  };

  const HandleMapDelete = (id) => {
    WebSocketManagerInstance.Send({ command: "map_remove", data: id });
  };

  const Reload = React.useCallback(async () => {
    const response = await WebHelper.getAsync(`map/getAllFlat`);
    setMaps(response ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    Reload();
    ClientMediator.sendCommandWaitForRegister(
      "BattleMap",
      "GetSelectedMapID",
      { contextId: battleMapId },
      true
    ).then((r) => {
      if (r) setValue(r);
    });
  }, [battleMapId, Reload]);

  const bmName = useBMName(battleMapId);
  const ctx = Dockable.useContentContext();
  ctx.setTitle(`Map Selector - ${bmName ?? '…'}`);

  const HandleSelectedMapChange = (id) => {
    const command = CommandFactory.CreateChangeMapCommand(id, battleMapId);
    WebSocketManagerInstance.Send(command);
  };

  const HandleAdd = () => {
    WebSocketManagerInstance.Send(CommandFactory.CreateMapAddCommand());
  };

  return (
    <BasePanel>
      <CollectionSyncer
        collection={maps}
        setCollection={setMaps}
        onAnyChange={Reload}
        commandPrefix={"map"}
        selectItemCommand={"map_change"}
        onSelectedChanged={(item) => {
          if (item?.id === battleMapId) {
            setValue(item.mapId);
          }
        }}
      />

      {/* Reload when map settings (e.g. name) change */}
      <Subscribable commandPrefix="settings_map" onMessage={Reload} />

      {loading ? (
        <Flex flex="1" align="center" justify="center" gap={2} color="gray.500">
          <Spinner size="sm" />
          <Text fontSize="sm">Loading maps…</Text>
        </Flex>
      ) : (
        <DList mainComponent={true} withAddButton={true} handleAdd={HandleAdd}>
          {maps.length === 0 && (
            <Flex
              direction="column"
              align="center"
              justify="center"
              gap={2}
              py={8}
              color="gray.500"
            >
              <Icon as={FaMap} boxSize={6} opacity={0.4} />
              <Text fontSize="sm">No maps yet. Add one below.</Text>
            </Flex>
          )}

          {maps.map((x) => {
            const isActive = x.id === value;
            return (
              <DListItem
                key={x.id}
                isSelected={isActive}
                withHover={!isActive}
                onClick={() => HandleSelectedMapChange(x.id)}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text", "map");
                  sessionStorage.setItem(
                    "draggable",
                    JSON.stringify({ entityType: "MapModel", id: x.id })
                  );
                }}
              >
                {/* Map icon */}
                <Flex
                  boxSize="36px"
                  borderRadius="md"
                  bg={isActive ? "var(--nordvik-selection-color)" : "whiteAlpha.100"}
                  align="center"
                  justify="center"
                  flexShrink={0}
                  mr={2}
                  border="1px solid"
                  borderColor={isActive ? "whiteAlpha.300" : "whiteAlpha.100"}
                  transition="all 0.15s"
                >
                  <Icon
                    as={FaMap}
                    boxSize={4}
                    color={isActive ? "white" : "gray.400"}
                  />
                </Flex>

                {/* Name + active label */}
                <Box flex="1" minW={0} cursor="pointer">
                  <Text
                    fontWeight={isActive ? "semibold" : "normal"}
                    fontSize="sm"
                    noOfLines={1}
                    color={isActive ? "white" : "var(--nordvik-text-color)"}
                  >
                    {x.name}
                  </Text>
                  {isActive && (
                    <Flex align="center" gap={1}>
                      <Icon as={MdCheckCircle} boxSize={3} color="green.400" />
                      <Text fontSize="xs" color="green.400">
                        Active
                      </Text>
                    </Flex>
                  )}
                </Box>

                <DListItemsButtonContainer>
                  <DListItemButton
                    label={"Settings"}
                    icon={FaWrench}
                    onClick={(e) => { e.stopPropagation(); HandleSettings(x.id); }}
                  />
                  <DListItemButton
                    label={"Remove"}
                    color={"red"}
                    hidden={isActive}
                    icon={IoIosRemoveCircleOutline}
                    onClick={(e) => { e.stopPropagation(); HandleMapDelete(x.id); }}
                  />
                </DListItemsButtonContainer>
              </DListItem>
            );
          })}
        </DList>
      )}
    </BasePanel>
  );
};
export default MapSelector;
