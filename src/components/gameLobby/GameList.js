import * as React from "react";
import {
  Stack,
  Box,
  Button,
  ButtonGroup,
  Heading,
  HStack,
  Separator,
} from "@chakra-ui/react";
import WebHelper from "../../helpers/WebHelper";
import { JoinDialog } from "./JoinDialog";
import CreateNewDialog from "./CreateNewDialog";
import Loadable from "../uiComponents/base/Loadable";
import GameListItem from "./GameListItem";
import { FaCog, FaUser, FaUserFriends } from "react-icons/fa";
import { IoMdLogOut } from "react-icons/io";
import { UserManagementDialog } from "./UserManagementDialog";
import { AppSettingsDialog } from "./AppSettingsDialog";

export const GameList = ({ OnSuccess, OnLogout }) => {
  const [gameList, setGameList] = React.useState(undefined);
  const [userData, setUserData] = React.useState(false);

  const openAppSettingsRef = React.useRef();
  const openUserManagementRef = React.useRef();

  let Load = async (finished) => {
    let games = await WebHelper.getAsync("gamelist/getgames");
    setGameList(games);

    let userData = await WebHelper.getAsync("user/userinfo");
    setUserData(userData);

    finished();
  };

  return (
    <Loadable OnLoad={Load}>
      <UserManagementDialog openRef={openUserManagementRef} />
      <AppSettingsDialog openRef={openAppSettingsRef} />
      <JoinDialog OnSuccess={(r) => OnSuccess(r)} />
      <Stack
        style={{
          width: "60%",
          margin: "0 auto",
          height: "100vh",
        }}
      >
        <Heading padding={4} size={"md"}>
          Hello, {userData.userName}
        </Heading>
        <ButtonGroup margin={"25px"} marginBottom={"50px"}>
          {userData.admin && (
            <Button variant={'outline'}
              onClick={() => openAppSettingsRef.current()}
              leftIcon={<FaCog />}
            >
              {" "}
              Application Settings{" "}
            </Button>
          )}
          {userData.admin && (
            <Button variant={'outline'}
              onClick={() => openUserManagementRef.current()}
              leftIcon={<FaUserFriends />}
            >
              {" "}
              User Management{" "}
            </Button>
          )}
          <Button variant={'outline'} leftIcon={<IoMdLogOut />} onClick={OnLogout}>
            Logout
          </Button>
        </ButtonGroup>
        <Box width={"100%"} height={"80%"}>
          <HStack wrap={"wrap"}>{getGameList()}</HStack>
        </Box>
        <Separator />
        <CreateNewDialog
          OnSuccess={() => WebHelper.get("gamelist/getgames", setGameList)}
        />
      </Stack>
    </Loadable>
  );

  function getGameList() {
    if (gameList !== undefined) {
      return gameList.map((x) => (
        <GameListItem key={x.id} game={x} onClick={() => OnSuccess(x.id)} reload={() => WebHelper.get("gamelist/getgames", setGameList)} />
      ));
    }
    return <></>;
  }
};

export default GameList;
