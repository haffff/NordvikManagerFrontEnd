import * as React from "react";
import {
  Stack,
  Box,
  Button,
  HStack,
  Heading,
  Icon,
  Separator,
  Text,
  Spinner,
} from "@chakra-ui/react";
import WebHelper from "../../helpers/WebHelper";
import { JoinDialog } from "./JoinDialog";
import CreateNewDialog from "./CreateNewDialog";
import GameListItem from "./GameListItem";
import { FaCog, FaUserFriends, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { IoMdLogOut } from "react-icons/io";
import { UserManagementDialog } from "./UserManagementDialog";
import { AppSettingsDialog } from "./AppSettingsDialog";
import { NewVersionDialog } from "./NewVersionDialog";

const PUBLIC_GAMES_PAGE_SIZE = 10;

export const GameList = ({ OnSuccess, OnLogout }) => {
  const [gameList, setGameList] = React.useState(undefined);
  const [userData, setUserData] = React.useState(null);   // null = loading
  const [meta, setMeta] = React.useState(null);

  const [updateAvailable, setUpdateAvailable] = React.useState(false);
  const [versionInfo, setVersionInfo] = React.useState(undefined);

  const [publicGames, setPublicGames] = React.useState([]);
  const [publicPage, setPublicPage] = React.useState(1);
  const [publicTotal, setPublicTotal] = React.useState(0);
  const [publicLoading, setPublicLoading] = React.useState(false);

  const openAppSettingsRef = React.useRef();
  const openUserManagementRef = React.useRef();

  const load = React.useCallback(async () => {
    const [games, user, serverMeta] = await Promise.all([
      WebHelper.getAsync("gamelist/getgames"),
      WebHelper.getAsync("user/userinfo"),
      WebHelper.getAsync("meta"),
    ]);
    setGameList(games);
    setUserData(user);
    setMeta(serverMeta);

    if (user?.localAdmin) {
      const ver = await WebHelper.getAsync("gamelist/versioninfo");
      if (ver?.isUpdateAvailable) {
        setUpdateAvailable(true);
        setVersionInfo(ver);
      }
    }
  }, []);

  const loadPublicGames = React.useCallback(async (page) => {
    setPublicLoading(true);
    try {
      const result = await WebHelper.getAsync(
        `gamelist/publicgames?page=${page}&count=${PUBLIC_GAMES_PAGE_SIZE}`
      );
      setPublicGames(result?.data ?? []);
      setPublicTotal(result?.total ?? 0);
      setPublicPage(result?.page ?? page);
    } finally {
      setPublicLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { loadPublicGames(1); }, [loadPublicGames]);

  const totalPages = Math.ceil(publicTotal / PUBLIC_GAMES_PAGE_SIZE);

  const handlePublicPageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    loadPublicGames(newPage);
  };

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
          {userData?.localAdmin && (
            <Button variant="outline" onClick={() => openAppSettingsRef.current()}>
              <Icon as={FaCog} /> Application Settings
            </Button>
          )}
          {userData?.localAdmin && (
            <Button variant="outline" onClick={() => openUserManagementRef.current()}>
              <Icon as={FaUserFriends} /> User Management
            </Button>
          )}
          <Button variant="outline" onClick={OnLogout}>
            <Icon as={IoMdLogOut} /> Logout
          </Button>
        </HStack>

        <Box width={"100%"}>
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
          publicGamesAllowed={meta?.publicGamesAllowed !== false}
          OnSuccess={() => {
            WebHelper.get("gamelist/getgames", setGameList);
            loadPublicGames(publicPage);
          }}
        />

        <Separator marginTop={4} />

        {/* Public Games Section */}
        <Box width={"100%"} paddingBottom={8}>
          <HStack justify="space-between" align="center" marginBottom={3}>
            <Heading size={"sm"}>Public Games</Heading>
            {publicTotal > 0 && (
              <Text fontSize="xs" color="gray.400">
                {publicTotal} game{publicTotal !== 1 ? "s" : ""} available
              </Text>
            )}
          </HStack>

          {publicLoading ? (
            <HStack justify="center" padding={6}>
              <Spinner size="md" />
            </HStack>
          ) : publicGames.length === 0 ? (
            <Text fontSize="sm" color="gray.500" padding={2}>
              No public games available.
            </Text>
          ) : (
            <HStack wrap={"wrap"}>
              {publicGames.map((x) => (
                <GameListItem
                  key={x.id}
                  game={x}
                  onClick={() => OnSuccess(x.id)}
                  reload={() => loadPublicGames(publicPage)}
                />
              ))}
            </HStack>
          )}

          {totalPages > 1 && (
            <HStack justify="center" marginTop={4} gap={2}>
              <Button
                size="sm"
                variant="outline"
                disabled={publicPage <= 1 || publicLoading}
                onClick={() => handlePublicPageChange(publicPage - 1)}
              >
                <Icon as={FaChevronLeft} />
              </Button>
              <Text fontSize="sm" color="gray.300" minWidth="80px" textAlign="center">
                Page {publicPage} of {totalPages}
              </Text>
              <Button
                size="sm"
                variant="outline"
                disabled={publicPage >= totalPages || publicLoading}
                onClick={() => handlePublicPageChange(publicPage + 1)}
              >
                <Icon as={FaChevronRight} />
              </Button>
            </HStack>
          )}
        </Box>
      </Stack>
    </>
  );
};

export default GameList;
