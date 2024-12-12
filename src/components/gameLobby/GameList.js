import * as React from "react";
import {
  Stack,
  Box,
  Button,
  Divider,
  Wrap,
  ButtonGroup,
} from "@chakra-ui/react";
import WebHelper from "../../helpers/WebHelper";
import { JoinDialog } from "./JoinDialog";
import CreateNewDialog from "./CreateNewDialog";
import Loadable from "../uiComponents/base/Loadable";
import GameListItem from "./GameListItem";

export const GameList = ({ OnSuccess, OnLogout }) => {
  const [gameList, setGameList] = React.useState(undefined);

  let Load = (finished) => {
    WebHelper.get("gamelist/getgames", (e) => {
      setGameList(e);
      finished();
    });
  };

  return (
    <Loadable OnLoad={Load}>
      <Stack
        style={{
          width: "60%",
          margin: "0 auto",
          height: "100vh",
        }}
      >
        <ButtonGroup margin={'25px'} marginBottom={'50px'}>
          <Button onClick={OnLogout}>Logout</Button>
        </ButtonGroup>
        <Box width={"100%"} height={"80%"}>
          <Wrap>{getGameList()}</Wrap>
        </Box>
        <Divider />
        <CreateNewDialog
          OnSuccess={() => WebHelper.get("gamelist/getgames", setGameList)}
        />
      </Stack>
      <JoinDialog OnSuccess={(r) => OnSuccess(r)} />
    </Loadable>
  );

  function getGameList() {
    if (gameList !== undefined) {
      return gameList.map((x) => (
        <GameListItem key={x.id} game={x} onClick={() => OnSuccess(x.id)} />
      ));
    }
    return <></>;
  }
};
export default GameList;
