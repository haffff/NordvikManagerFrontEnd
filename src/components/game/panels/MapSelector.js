import * as React from "react";
import { RadioGroup, Radio, Stack, Box } from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import { FaPlus, FaRemoveFormat, FaWrench, FaXbox } from "react-icons/fa";
import WebHelper from "../../../helpers/WebHelper";
import WebSocketManagerInstance from "../WebSocketManager";
import Subscribable from "../../uiComponents/base/Subscribable";
import MapSettingsPanel from "../settings/MapSettingsPanel";
import { IoIosRemoveCircleOutline, IoMdRemove } from "react-icons/io";
import DList from "../../uiComponents/base/List/DList";
import DListItem from "../../uiComponents/base/List/DListItem";
import DListItemButton from "../../uiComponents/base/List/ListItemDetails/DListItemButton";
import DListItemsButtonContainer from "../../uiComponents/base/List/DListItemsButtonContainer";
import BasePanel from "../../uiComponents/base/BasePanel";
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
    WebSocketManagerInstance.Send({
        command: "map_remove",
        data: id,
    })
  };

  const Reload = async () => {
    let response = await WebHelper.getAsync(`map/getAllFlat`);
    setMaps(response);
  };

  React.useEffect(() => {
    Reload();
    ClientMediator.sendCommandWaitForRegister(
      "BattleMap",
      "GetSelectedMapID",
      { contextId: battleMapId },
      true
    ).then((r) => {
      setValue(r);
    });
  }, []);

  const bmName = useBMName(battleMapId);

  const ctx = Dockable.useContentContext();
  ctx.setTitle(`Map Selector - ` + bmName);

  const HandleSelectedMapChange = (e) => {
    let command = CommandFactory.CreateChangeMapCommand(e, battleMapId);
    WebSocketManagerInstance.Send(command);
  };

  const HandleAdd = () => {
    let cmd = CommandFactory.CreateMapAddCommand();
    WebSocketManagerInstance.Send(cmd);
  };

  return (
    <BasePanel>
      <CollectionSyncer
        collection={maps}
        setCollection={setMaps}
        onAnyChange={() => Reload()}
        commandPrefix={"map"}
        selectItemCommand={"map_change"}
        onSelectedChanged={(item) => {
          setValue(item.mapId);
        }}
      />
      <DList
        mainComponent={true}
        withAddButton={true}
        handleAdd={HandleAdd}
      >
        {maps.map((x) => (
          <DListItem
            key={x.id}
            selected={x.id === value}
            bgColor={x.id === value ? "rgba(120,120,120,0.5)" : ""}
          >
            <Box
              onClick={() => {
                HandleSelectedMapChange(x.id);
              }}
            >
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
