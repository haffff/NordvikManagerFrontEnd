import * as React from 'react';
import {
  Stack,
  Box,
  Button,
  HStack,
  Heading,
  Icon,
  Input,
  Text,
  Badge,
  Flex,
  Separator,
  Spinner,
} from '@chakra-ui/react';
import { FaLock, FaUsers, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { IoMdLogOut } from 'react-icons/io';
import CentralWebHelper from '../../helpers/CentralWebHelper';

const PUBLIC_SESSIONS_PAGE_SIZE = 10;

// ─── Session card ─────────────────────────────────────────────────────────────

const SessionCard = ({ session, onJoin }) => {
  const isLocked = session.passwordRequired;

  return (
    <Box
      position="relative"
      width="200px"
      minHeight="280px"
      borderRadius="xl"
      overflow="hidden"
      border="1px solid"
      borderColor="whiteAlpha.200"
      bg="gray.800"
      cursor="pointer"
      _hover={{ transform: 'translateY(-4px)', shadow: 'xl', borderColor: 'whiteAlpha.400' }}
      transition="transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease"
      onClick={() => onJoin(session)}
    >
      {/* Cover image */}
      {session.imageData && (
        <Box position="absolute" inset={0} zIndex={0}>
          <img
            src={session.imageData}
            alt={session.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <Box
            position="absolute" inset={0}
            bgGradient="to-t"
            gradientFrom="blackAlpha.900"
            gradientTo="blackAlpha.300"
          />
        </Box>
      )}

      {/* Subtle dot-pattern fallback */}
      {!session.imageData && (
        <Box
          position="absolute" inset={0} zIndex={0}
          opacity={0.12}
          backgroundImage="radial-gradient(circle, white 1px, transparent 1px)"
          backgroundSize="24px 24px"
        />
      )}

      {/* Lock badge */}
      {isLocked && (
        <Box position="absolute" top={2} right={2} zIndex={2}>
          <Badge colorPalette="yellow" size="sm" title="Password required">
            <Icon as={FaLock} />
          </Badge>
        </Box>
      )}

      {/* Content pinned to bottom */}
      <Flex
        position="relative" zIndex={1}
        direction="column"
        justify="flex-end"
        height="280px"
        p={4}
        gap={2}
      >
        <Heading size="sm" color="white" textShadow="0 1px 4px rgba(0,0,0,0.8)" lineClamp={2}>
          {session.name}
        </Heading>

        {session.summary && (
          <Text
            fontSize="xs"
            color="whiteAlpha.800"
            lineClamp={2}
            textShadow="0 1px 3px rgba(0,0,0,0.9)"
          >
            {session.summary}
          </Text>
        )}

        <Separator borderColor="whiteAlpha.300" />

        <HStack gap={2} justify="space-between" align="center">
          <Button
            size="sm"
            variant="solid"
            flex={1}
            bg="whiteAlpha.200"
            color="white"
            _hover={{ bg: 'whiteAlpha.400' }}
            backdropFilter="blur(4px)"
            onClick={(e) => { e.stopPropagation(); onJoin(session); }}
          >
            Connect
          </Button>

          {session.playerCount != null && (
            <HStack gap={1} color="whiteAlpha.700" fontSize="xs" flexShrink={0}>
              <Icon as={FaUsers} />
              <Text>{session.playerCount}</Text>
            </HStack>
          )}
        </HStack>
      </Flex>
    </Box>
  );
};

// ─── Session list ─────────────────────────────────────────────────────────────

export const SessionList = ({ OnSuccess, OnJoin, OnLogout }) => {
  const [sessions, setSessions] = React.useState(undefined);
  const [publicSessions, setPublicSessions] = React.useState([]);
  const [publicGamesAllowed, setPublicGamesAllowed] = React.useState(false);
  const [publicPage, setPublicPage] = React.useState(1);
  const [publicTotal, setPublicTotal] = React.useState(0);
  const [publicLoading, setPublicLoading] = React.useState(false);
  const [userData, setUserData] = React.useState(null);
  const [joinId, setJoinId] = React.useState('');

  const loadPublicSessions = React.useCallback(async (page) => {
    setPublicLoading(true);
    try {
      const result = await CentralWebHelper.getAsync(
        `gamelist/publicgames?page=${page}&count=${PUBLIC_SESSIONS_PAGE_SIZE}`
      );
      setPublicSessions(result?.data ?? []);
      setPublicTotal(result?.total ?? 0);
      setPublicPage(result?.page ?? page);
    } finally {
      setPublicLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const load = async () => {
      const [sessionData, user, meta] = await Promise.all([
        CentralWebHelper.getAsync('gamelist/getgames'),
        CentralWebHelper.getAsync('user/userinfo'),
        CentralWebHelper.getAsync('meta'),
      ]);
      setSessions(sessionData ?? []);
      setUserData(user);

      if (meta?.publicGamesAllowed) {
        setPublicGamesAllowed(true);
        loadPublicSessions(1);
      }
    };
    load();
  }, [loadPublicSessions]);

  const totalPages = Math.ceil(publicTotal / PUBLIC_SESSIONS_PAGE_SIZE);

  const handlePublicPageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    loadPublicSessions(newPage);
  };

  const handleJoinById = () => {
    const id = joinId.trim();
    if (id) OnJoin(id);
  };

  return (
    <Stack style={{ width: '60%', margin: '0 auto', height: '100vh' }}>
      <Heading padding={4} size="md">
        Hello, {userData?.userName ?? '…'}
      </Heading>

      <HStack margin="25px" marginBottom="50px" gap={2}>
        <Button variant="outline" onClick={OnLogout}>
          <Icon as={IoMdLogOut} /> Logout
        </Button>
        <Input
          placeholder="Session ID"
          value={joinId}
          onChange={(e) => setJoinId(e.target.value)}
          onKeyUp={(e) => { if (e.key === 'Enter') handleJoinById(); }}
          width="200px"
        />
        <Button variant="outline" onClick={handleJoinById} disabled={!joinId.trim()}>
          Join by ID
        </Button>
      </HStack>

      <Box width="100%" height="80%">
        {sessions === undefined && (
          <Text color="whiteAlpha.600">Loading sessions…</Text>
        )}
        {sessions?.length === 0 && !publicGamesAllowed && (
          <Text color="whiteAlpha.600">No sessions available. Ask your GM for an invite.</Text>
        )}
        <HStack wrap="wrap">
          {sessions?.map((s) => (
            <SessionCard key={s.id} session={s} onJoin={(session) => OnSuccess(session.id, session.id)} />
          ))}
        </HStack>

        {publicGamesAllowed && (
          <>
            <Separator mt={6} mb={4} />
            <HStack justify="space-between" align="center" mb={4}>
              <Heading size="sm" color="whiteAlpha.800">
                Public Games
              </Heading>
              {publicTotal > 0 && (
                <Text fontSize="xs" color="whiteAlpha.600">
                  {publicTotal} game{publicTotal !== 1 ? 's' : ''} available
                </Text>
              )}
            </HStack>

            {publicLoading ? (
              <HStack justify="center" padding={6}>
                <Spinner size="md" />
              </HStack>
            ) : publicSessions.length === 0 ? (
              <Text color="whiteAlpha.600">No public games available right now.</Text>
            ) : (
              <HStack wrap="wrap">
                {publicSessions.map((s) => (
                  <SessionCard key={s.id} session={s} onJoin={(session) => OnJoin(session.id)} />
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
          </>
        )}
      </Box>
    </Stack>
  );
};

export default SessionList;
