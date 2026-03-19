import * as React from "react";
import {
  Stack,
  Box,
  Button,
  HStack,
  Heading,
  Icon,
  Separator,
} from "@chakra-ui/react";
import WebHelper from "../../helpers/WebHelper";
import { JoinDialog } from "./JoinDialog";
import CreateNewDialog from "./CreateNewDialog";
import GameListItem from "./GameListItem";
import { FaCog, FaUserFriends } from "react-icons/fa";
import { IoMdLogOut } from "react-icons/io";
import { UserManagementDialog } from "./UserManagementDialog";
import { AppSettingsDialog } from "./AppSettingsDialog";
import { NewVersionDialog } from "./NewVersionDialog";

export const GameList = ({ OnSuccess, OnLogout }) => {
  const [gameList, setGameList] = React.useState(undefined);
  const [userData, setUserData] = React.useState(null);   // null = loading

  const [updateAvailable, setUpdateAvailable] = React.useState(false);
  const [versionInfo, setVersionInfo] = React.useState(undefined);

  const openAppSettingsRef = React.useRef();
  const openUserManagementRef = React.useRef();

  const load = React.useCallback(async () => {
    const [games, user] = await Promise.all([
      WebHelper.getAsync("gamelist/getgames"),
      WebHelper.getAsync("user/userinfo"),
    ]);
    setGameList(games);
    setUserData(user);

    if (user?.admin) {
      const ver = await WebHelper.getAsync("gamelist/versioninfo");
      if (ver?.isUpdateAvailable) {
        setUpdateAvailable(true);
        setVersionInfo(ver);
      }
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  return (
    <>
      <UserManagementDialog openRef={openUserManagementRef} />
      <AppSettingsDialog openRef={openAppSettingsRef} />
      <NewVersionDialog open={updateAvailable} versionInfo={versionInfo} onClose={() => setUpdateAvailable(false)} />
      <JoinDialog OnSuccess={(r) => OnSuccess(r)} />
      <Stack
        style={{
          width: "60%",
          margin: "0 auto",
          height: "100vh",
        }}
      >
        <Heading padding={4} size={"md"}>
          Hello, {userData?.userName ?? "…"}
        </Heading>

        <HStack margin={"25px"} marginBottom={"50px"} gap={2}>
          {userData?.admin && (
            <Button variant="outline" onClick={() => openAppSettingsRef.current()}>
              <Icon as={FaCog} /> Application Settings
            </Button>
          )}
          {userData?.admin && (
            <Button variant="outline" onClick={() => openUserManagementRef.current()}>
              <Icon as={FaUserFriends} /> User Management
            </Button>
          )}
          <Button variant="outline" onClick={OnLogout}>
            <Icon as={IoMdLogOut} /> Logout
          </Button>
        </HStack>

        <Box width={"100%"} height={"80%"}>
          <HStack wrap={"wrap"}>
            {gameList?.map((x) => (
              <GameListItem
                key={x.id}
                game={x}
                onClick={() => OnSuccess(x.id)}
                reload={() => WebHelper.get("gamelist/getgames", setGameList)}
              />
            ))}
          </HStack>
        </Box>

        <Separator />
        <CreateNewDialog
          OnSuccess={() => WebHelper.get("gamelist/getgames", setGameList)}
        />
      </Stack>
    </>
  );
};

export default GameList;
