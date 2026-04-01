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
} from '@chakra-ui/react';
import { FaLock, FaUsers } from 'react-icons/fa';
import { IoMdLogOut } from 'react-icons/io';
import CentralWebHelper from '../../helpers/CentralWebHelper';

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
  const [userData, setUserData] = React.useState(null);
  const [joinId, setJoinId] = React.useState('');

  React.useEffect(() => {
    const load = async () => {
      const [sessionData, user] = await Promise.all([
        CentralWebHelper.getAsync('gamelist/getgames'),
        CentralWebHelper.getAsync('user/userinfo'),
      ]);
      setSessions(sessionData ?? []);
      setUserData(user);
    };
    load();
  }, []);

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
        {sessions?.length === 0 && (
          <Text color="whiteAlpha.600">No sessions available. Ask your GM for an invite.</Text>
        )}
        <HStack wrap="wrap">
          {sessions?.map((s) => (
            <SessionCard key={s.id} session={s} onJoin={(session) => OnSuccess(session.id)} />
          ))}
        </HStack>
      </Box>
    </Stack>
  );
};

export default SessionList;
