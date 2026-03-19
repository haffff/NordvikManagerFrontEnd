import * as React from "react";
import { Box } from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import { FaWrench } from "react-icons/fa";
import WebHelper from "../../../helpers/WebHelper";
import WebSocketManagerInstance from "../WebSocketManager";
import MapSettingsPanel from "../settings/MapSettingsPanel";
import { IoIosRemoveCircleOutline } from "react-icons/io";
import DList from "../../uiComponents/base/List/DList";
import DListItem from "../../uiComponents/base/List/DListItem";
import DListItemButton from "../../uiComponents/base/List/ListItemDetails/DListItemButton";
import DListItemsButtonContainer from "../../uiComponents/base/List/DListItemsButtonContainer";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import ClientMediator from "../../../ClientMediator";
import useBMName from "../../uiComponents/hooks/useBattleMapName";
import CollectionSyncer from "../../uiComponents/base/CollectionSyncer";

export const MapSelector = ({ battleMapId, state }) => {
  const [value, setValue] = React.useState(undefined);
  const [maps, setMaps] = React.useState([]);

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
  }, []);

  React.useEffect(() => {
    Reload();
    // waitForRegister so this resolves even if the BattleMap canvas is still loading
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
          // item = { mapId: <the new map id>, id: <battleMapId> }
          if (item?.id === battleMapId) {
            setValue(item.mapId);
          }
        }}
      />
      <DList mainComponent={true} withAddButton={true} handleAdd={HandleAdd}>
        {maps.map((x) => (
          <DListItem
            key={x.id}
            selected={x.id === value}
            bgColor={x.id === value ? "rgba(120,120,120,0.5)" : ""}
            draggable={true}
            onDragStart={(e) => {
              e.dataTransfer.setData("text", "map");
              sessionStorage.setItem("draggable", JSON.stringify({ entityType: "MapModel", id: x.id }));
            }}
          >
            <Box onClick={() => HandleSelectedMapChange(x.id)}>
              {x.name}
            </Box>
            <DListItemsButtonContainer>
              <DListItemButton
                label={"Remove"}
                color={"red"}
                hidden={x.id === value}
                icon={IoIosRemoveCircleOutline}
                onClick={() => HandleMapDelete(x.id)}
              />
              <DListItemButton
                label={"Settings"}
                icon={FaWrench}
                onClick={() => HandleSettings(x.id)}
              />
            </DListItemsButtonContainer>
          </DListItem>
        ))}
      </DList>
    </BasePanel>
  );
};
export default MapSelector;
