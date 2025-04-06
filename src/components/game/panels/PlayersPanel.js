import * as React from "react";
import { Flex, Circle, FormLabel } from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import DList from "../../uiComponents/base/List/DList";
import DListItem from "../../uiComponents/base/List/DListItem";
import PlayerAvatar from "../../uiComponents/PlayerAvatar";
import DListItemsButtonContainer from "../../uiComponents/base/List/DListItemsButtonContainer";
import DLabel from "../../uiComponents/base/Text/DLabel";
import ClientMediator from "../../../ClientMediator";
import useClientMediator from "../../uiComponents/hooks/useClientMediator";
import "../../../stylesheets/player.css";
import BasePanel from "../../uiComponents/base/BasePanel";
import { useDimensions } from "../../uiComponents/hooks/useDimensions";

export const PlayersPanel = () => {
  const [playersList, setPlayersList] = React.useState([]);

  const panelRef = React.useRef(null);
  const { width, height } = useDimensions(panelRef);

  const ctx = Dockable.useContentContext();
  ctx.setTitle(`Players`);

  const HandleMessage = async ({all, connected}) => {
    setPlayersList([...connected] || []);
  };

  const HandleEvent = (ev, data) => {
    if (ev === "PlayersChanged") {
      HandleMessage(data);
    }
  };

  useClientMediator("PlayersPanel", { onEvent: HandleEvent });

  React.useEffect(() => {
    const GetData = async () => {
      const connectedPlayers = await ClientMediator.sendCommandWaitForRegisterAsync("Game","GetConnectedPlayers",{}, true);
      setPlayersList([...connectedPlayers] || []);
    };

    GetData();
  }, []);

  const smallerThan200 = width < 200;
  const horizontal = height > 200;

  console.log(width, height);

  return (
    <BasePanel direction={horizontal ? "column" : "row"} baseRef={panelRef}>
      {playersList.map((x) => (
        <DListItem
          key={x.id}
          flexProps={{ 
            direction: horizontal ? "row" : "column" ,
          }}
        >
        <PlayerAvatar
         player={x} />
          {!smallerThan200 && (
            <DLabel>{x.name ? x.name : x.Name}</DLabel>
          )}
        </DListItem>
      ))}
    </BasePanel>
  );
};
export default PlayersPanel;
