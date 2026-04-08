import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  Image,
  Input,
  Separator,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { IoMdMore } from "react-icons/io";
import {
  FaCopy,
  FaEdit,
  FaLink,
  FaLock,
  FaSave,
  FaTrash,
  FaUnlock,
  FaUsers,
} from "react-icons/fa";

import WebHelper from "../../helpers/WebHelper";
import React from "react";
import {
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
} from "../ui/dialog";
import { toaster } from "../ui/toaster";

const PLAYER_FRONTEND_URL = (
  process.env.REACT_APP_PLAYER_FRONTEND_URL ||
  (process.env.REACT_APP_CENTRAL_URL + '/client')
).replace(/\/$/, '');

// ─── Settings Dialog ──────────────────────────────────────────────────────────

const GameSettingsDialog = ({ game, open, onClose, onDeleted, onSaved }) => {
  const [name, setName]               = React.useState(game?.name ?? "");
  const [description, setDescription] = React.useState(game?.description ?? "");
  const [saving, setSaving]           = React.useState(false);
  const [deleting, setDeleting]       = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Sync fields when the dialog opens for a (possibly) different game
  React.useEffect(() => {
    if (open) {
      setName(game?.name ?? "");
      setDescription(game?.description ?? "");
      setConfirmDelete(false);
    }
  }, [open, game]);

  const isDirty = name !== (game?.name ?? "") || description !== (game?.description ?? "");

  const handleSave = async () => {
    if (!isDirty) return;
    setSaving(true);
    try {
      const resp = await WebHelper.postAsync("gamelist/updategame", {
        gameId: game.id,
        name,
        description,
      });
      if (resp?.ok ?? resp) {
        toaster.create({ description: `"${name}" updated.`, type: "success", duration: 3000 });
        onSaved();
        onClose();
      } else {
        toaster.create({ description: "Failed to save changes.", type: "error", duration: 4000 });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await WebHelper.deleteAsync("gamelist/deletegame?gameId=" + game.id);
      toaster.create({ description: `"${game.name}" deleted.`, type: "success", duration: 3000 });
      onDeleted();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DialogRoot open={open} onOpenChange={(e) => { if (!e.open) onClose(); }} size="md">
      <DialogBackdrop />
      <DialogContent>
        <DialogCloseTrigger />
        <DialogHeader>
          <HStack gap={2}>
            <Icon as={FaEdit} />
            <Text>Game Settings</Text>
          </HStack>
        </DialogHeader>

        <DialogBody>
          <Stack gap={4}>
            {/* Preview banner */}
            {game?.image && (
              <Box borderRadius="md" overflow="hidden" height="100px" position="relative">
                <Image
                  src={WebHelper.getResourceString(game.image, undefined, game.id)}
                  alt={game.name}
                  width="100%"
                  height="100%"
                  objectFit="cover"
                />
                <Box
                  position="absolute" inset={0}
                  bgGradient="to-t"
                  gradientFrom="blackAlpha.700"
                  gradientTo="transparent"
                />
              </Box>
            )}

            <Box>
              <Text fontSize="sm" mb={1} color="gray.400">Game Name</Text>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Game name"
              />
            </Box>

            <Box>
              <Text fontSize="sm" mb={1} color="gray.400">Description</Text>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description…"
                rows={3}
              />
            </Box>

            {/* Invite link */}
            <Box>
              <Text fontSize="sm" mb={1} color="gray.400">
                <Icon as={FaLink} mr={1} />
                Player Invite Link
              </Text>
              <HStack gap={2}>
                <Input
                  readOnly
                  size="sm"
                  value={`${PLAYER_FRONTEND_URL}/?game=${game?.centralSessionId ?? ''}${game?.passwordRequired ? '&rp=1' : ''}`}
                  color="gray.300"
                  fontFamily="mono"
                  fontSize="xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  flexShrink={0}
                  onClick={() => {
                    const url = `${PLAYER_FRONTEND_URL}/?game=${game?.id ?? ''}${game?.passwordRequired ? '&rp=1' : ''}`;
                    navigator.clipboard.writeText(url).then(() =>
                      toaster.create({ description: "Invite link copied!", type: "success", duration: 2500 })
                    );
                  }}
                >
                  <Icon as={FaCopy} />
                </Button>
              </HStack>
            </Box>

            <Separator />

            {/* Danger zone */}
            <Box
              p={3} borderRadius="md"
              border="1px solid"
              borderColor={confirmDelete ? "red.600" : "whiteAlpha.100"}
              bg={confirmDelete ? "red.950" : "whiteAlpha.50"}
              transition="all 0.2s"
            >
              <Text fontSize="sm" fontWeight="semibold" color="red.400" mb={2}>
                Danger Zone
              </Text>
              {confirmDelete && (
                <Text fontSize="sm" color="red.300" mb={3}>
                  This will permanently delete <b>{game?.name}</b> and all its data. Are you sure?
                </Text>
              )}
              <Button
                colorPalette="red"
                variant={confirmDelete ? "solid" : "outline"}
                size="sm"
                loading={deleting}
                onClick={handleDelete}
              >
                <Icon as={FaTrash} />
                {confirmDelete ? "Confirm Delete" : "Delete Game"}
              </Button>
              {confirmDelete && (
                <Button size="sm" variant="ghost" ml={2} onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              )}
            </Box>
          </Stack>
        </DialogBody>

        <DialogFooter>
          <HStack gap={2}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              variant="outline"
              colorPalette="green"
              disabled={!isDirty}
              loading={saving}
              onClick={handleSave}
            >
              <Icon as={FaSave} />
              Save Changes
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

// ─── Card ─────────────────────────────────────────────────────────────────────

const GameListItem = ({ game, onClick, reload }) => {
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const hasImage = Boolean(game.image);
  const isLocked = Boolean(game.passwordRequired);

  return (
    <>
      <GameSettingsDialog
        game={game}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onDeleted={reload}
        onSaved={reload}
      />

      <Box
        position="relative"
        width="200px"
        minHeight="320px"
        borderRadius="xl"
        overflow="hidden"
        border="1px solid"
        borderColor="whiteAlpha.200"
        bg={game.color ?? "gray.800"}
        cursor="pointer"
        _hover={{ transform: "translateY(-4px)", shadow: "xl", borderColor: "whiteAlpha.400" }}
        transition="transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease"
        onClick={() => onClick(game.id)}
      >
        {/* Cover image with gradient overlay */}
        {hasImage ? (
          <Box position="absolute" inset={0} zIndex={0}>
            <Image
              src={WebHelper.getResourceString(game.image, undefined, game.id)}
              alt={game.name}
              width="100%"
              height="100%"
              objectFit="cover"
            />
            <Box
              position="absolute" inset={0}
              bgGradient="to-t"
              gradientFrom="blackAlpha.900"
              gradientTo="blackAlpha.300"
            />
          </Box>
        ) : (
          /* Subtle dot-pattern fallback */
          <Box
            position="absolute" inset={0} zIndex={0}
            opacity={0.12}
            backgroundImage="radial-gradient(circle, white 1px, transparent 1px)"
            backgroundSize="24px 24px"
          />
        )}

        {/* Badges — top-right */}
        <HStack
          position="absolute" top={2} right={2} zIndex={2}
          gap={1}
          onClick={(e) => e.stopPropagation()}
        >
          {isLocked && (
            <Badge colorPalette="yellow" size="sm" title="Password required">
              <Icon as={FaLock} />
            </Badge>
          )}
          {game.isOwner && (
            <Badge colorPalette="blue" size="sm">Owner</Badge>
          )}
        </HStack>

        {/* Settings gear — top-left (owner only) */}
        {game.isOwner && (
          <Box
            position="absolute" top={2} left={2} zIndex={2}
            onClick={(e) => e.stopPropagation()}
          >
            <IconButton
              size="xs"
              variant="ghost"
              title="Game settings"
              onClick={() => setSettingsOpen(true)}
              _hover={{ bg: "whiteAlpha.300" }}
            >
              <IoMdMore />
            </IconButton>
          </Box>
        )}

        {/* Content pinned to bottom */}
        <Flex
          position="relative" zIndex={1}
          direction="column"
          justify="flex-end"
          height="320px"
          p={4}
          gap={2}
        >
          <Heading size="sm" color="white" textShadow="0 1px 4px rgba(0,0,0,0.8)" lineClamp={2}>
            {game.name}
          </Heading>

          {game.shortDescription && (
            <Text
              fontSize="xs"
              color="whiteAlpha.800"
              lineClamp={2}
              textShadow="0 1px 3px rgba(0,0,0,0.9)"
            >
              {game.shortDescription}
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
              _hover={{ bg: "whiteAlpha.400" }}
              backdropFilter="blur(4px)"
              onClick={(e) => { e.stopPropagation(); onClick(game.id); }}
            >
              <Icon as={FaUnlock} />
              Join
            </Button>

            {game.playerCount != null && (
              <HStack gap={1} color="whiteAlpha.700" fontSize="xs" flexShrink={0}>
                <Icon as={FaUsers} />
                <Text>{game.playerCount}</Text>
              </HStack>
            )}
          </HStack>
        </Flex>
      </Box>
    </>
  );
};

export default GameListItem;
