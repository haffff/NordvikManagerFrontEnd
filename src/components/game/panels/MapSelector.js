import * as React from "react";
import { Box, Flex, Icon, Spinner, Text } from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import DockableHelper from "../../../helpers/DockableHelper";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import { FaMap } from "@react-icons/all-files/fa/FaMap";
import { FaMinusCircle } from "@react-icons/all-files/fa/FaMinusCircle";
import { FaWrench } from "@react-icons/all-files/fa/FaWrench";
import { MdCheckCircle } from "@react-icons/all-files/md/MdCheckCircle";
import { ActiveWebHelper as WebHelper } from "../../../helpers/transport";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import MapSettingsPanel from "../settings/MapSettingsPanel";
import DTreeListItem from "../../uiComponents/base/List/DTreeListItem";
import DListItemButton from "../../uiComponents/base/List/ListItemDetails/DListItemButton";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import ClientMediator from "../../../ClientMediator";
import useBMName from "../../uiComponents/hooks/useBattleMapName";
import CollectionSyncer from "../../uiComponents/base/CollectionSyncer";
import Subscribable from "../../uiComponents/base/Subscribable";
import DTreeList from "../../uiComponents/treeList/DTreeList";
import { usePermissions } from "../../../contexts/PermissionsContext";

// One map in the tree, like a card in the Cards list: click to load it on this battle map.
// Its actions (Settings, Remove, …) are in the toolbar and the right-click menu.
const MapRow = ({ map, isActive, onOpen }) => (
  <DTreeListItem gap="10px" padding="2px" isSelected={isActive} onClick={() => onOpen(map.id)}>
    <Flex
      boxSize="40px"
      borderRadius="md"
      bg={isActive ? "green.800" : "whiteAlpha.100"}
      align="center"
      justify="center"
      flexShrink={0}
      border="1px solid"
      borderColor={isActive ? "green.600" : "whiteAlpha.100"}
    >
      <Icon as={FaMap} boxSize={4} color={isActive ? "white" : "gray.400"} />
    </Flex>

    <Box flex="1" minW={0}>
      <Text fontWeight="semibold" fontSize="sm" noOfLines={1}>
        {map.name}
      </Text>
      {isActive ? (
        <Flex align="center" gap={1}>
          <Icon as={MdCheckCircle} boxSize={3} color="green.400" />
          <Text fontSize="xs" color="green.400">Active</Text>
        </Flex>
      ) : map.width && map.height ? (
        <Text fontSize="xs" color="gray.400" noOfLines={1}>{map.width} × {map.height}</Text>
      ) : null}
    </Box>
  </DTreeListItem>
);

export const MapSelector = ({ battleMapId, state }) => {
  const [value, setValue] = React.useState(undefined);
  const [maps, setMaps] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const { canEditGame } = usePermissions();

  const HandleSettings = (id) => {
    WebHelper.get(`map/get?mapId=${id}`, (r) => {
      DockableHelper.NewFloating(state, <MapSettingsPanel map={r} />);
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

  // From the toolbar's + or a folder's "+ New map here" row.
  const HandleAdd = (_selected, { parentId = null } = {}) => {
    WebSocketManagerInstance.Send(CommandFactory.CreateMapAddCommand(parentId));
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
        <DTreeList
          entityType="MapModel"
          transferKind="map"
          items={maps}
          canEditFolders={canEditGame}
          withAddItem={canEditGame}
          onAddItem={HandleAdd}
          addRowLabel="New map"
          onRefresh={Reload}
          estimatedRowHeight={52}
          // "Delete All" on a folder: the map on show stays, as it has no Remove
          onDeleteItem={(m) => { if (m.id !== value) HandleMapDelete(m.id); }}
          onGenerateEditButtons={canEditGame ? (m) => (
            <>
              <DListItemButton label="Settings" icon={FaWrench} onClick={() => HandleSettings(m.id)} />
              {m.id !== value && (
                <DListItemButton label="Remove" icon={FaMinusCircle} color="red" onClick={() => HandleMapDelete(m.id)} />
              )}
            </>
          ) : undefined}
          generateItem={(m) => (
            <MapRow map={m} isActive={m.id === value} onOpen={HandleSelectedMapChange} />
          )}
        />
      )}
    </BasePanel>
  );
};
export default MapSelector;
