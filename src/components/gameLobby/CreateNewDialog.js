import * as React from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  Image,
  Input,
  Separator,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { FaGlobe, FaLink, FaLock, FaPlus } from "react-icons/fa";
import { Checkbox } from "../ui/checkbox";
import {
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
} from "../ui/dialog";
import WebHelper from "../../helpers/WebHelper";

const EMPTY_FORM = (publicGamesAllowed) => ({
  passwordRequired: false,
  isPublic: publicGamesAllowed !== false,
});

export const CreateNewDialog = ({ OnSuccess, publicGamesAllowed = true }) => {
  const [open, setOpen]       = React.useState(false);
  const [form, setForm]       = React.useState(EMPTY_FORM(publicGamesAllowed));
  const [addons, setAddons]   = React.useState([]);
  const [busy, setBusy]       = React.useState(false);
  const [error, setError]     = React.useState(null);

  React.useEffect(() => {
    WebHelper.getAsync("gamelist/GetFeaturedAddons").then((result) => {
      if (result) setAddons(result);
    });
  }, []);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleOpen = () => {
    setForm(EMPTY_FORM(publicGamesAllowed));
    setError(null);
    setOpen(true);
  };

  const onSubmit = () => {
    if (!form.name?.trim()) { setError("Title is required."); return; }
    setBusy(true);
    setError(null);
    WebHelper.post(
      "gamelist/addgame",
      form,
      (obj) => { setBusy(false); OnSuccess(obj); setOpen(false); },
      async (resp) => {
        setBusy(false);
        const body = await resp?.json?.().catch(() => ({}));
        setError(body?.error ?? "Failed to create game. Please try again.");
      }
    );
  };

  return (
    <>
      <Button width="200px" variant="outline" onClick={handleOpen}>
        <Icon as={FaPlus} mr={2} /> Create new game
      </Button>

      <DialogRoot lazyMount open={open} onOpenChange={(e) => setOpen(e.open)} size="xl">
        <DialogBackdrop />
        <DialogContent>
          <DialogCloseTrigger />
          <DialogHeader>Create new game</DialogHeader>

          <DialogBody>
            <Stack gap={5}>
              {error && (
                <Box p={3} borderRadius="md" bg="red.950" border="1px solid" borderColor="red.700">
                  <Text fontSize="sm" color="red.300">{error}</Text>
                </Box>
              )}

              {/* ── Title + Image row ─────────────────────────────────── */}
              <Flex gap={6}>
                {/* Cover image */}
                <Box flexShrink={0}>
                  <Text fontSize="sm" color="gray.400" mb={2}>Cover image</Text>
                  <Box
                    width="120px" height="160px"
                    borderRadius="lg" overflow="hidden"
                    border="1px dashed" borderColor="whiteAlpha.300"
                    bg="gray.800"
                    display="flex" alignItems="center" justifyContent="center"
                    position="relative"
                  >
                    {form.image
                      ? <Image src={form.image} width="100%" height="100%" objectFit="cover" />
                      : <Text fontSize="xs" color="gray.500" textAlign="center" px={2}>No image</Text>
                    }
                  </Box>
                  <Input
                    mt={2} type="file" size="xs" variant="outline"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => set("image", ev.target.result);
                      reader.readAsDataURL(file);
                    }}
                  />
                </Box>

                {/* Title + visibility */}
                <Stack flex={1} gap={4}>
                  <Box>
                    <Text fontSize="sm" mb={1}>Title <Text as="span" color="red.400">*</Text></Text>
                    <Input
                      placeholder="My epic adventure"
                      onInput={(e) => set("name", e.target.value)}
                    />
                  </Box>

                  <Box>
                    <Text fontSize="sm" mb={1}>Short summary</Text>
                    <Input
                      placeholder="One-line teaser…"
                      onChange={(e) => set("summary", e.target.value)}
                    />
                  </Box>

                  <Separator />

                  {/* Visibility */}
                  <Stack gap={3}>
                    {publicGamesAllowed && (
                    <HStack
                      gap={3} p={3} borderRadius="md" cursor="pointer"
                      bg={form.isPublic ? "green.950" : "whiteAlpha.50"}
                      border="1px solid"
                      borderColor={form.isPublic ? "green.700" : "whiteAlpha.100"}
                      transition="all 0.15s"
                      onClick={() => set("isPublic", true)}
                    >
                      <Icon as={FaGlobe} color={form.isPublic ? "green.400" : "gray.500"} />
                      <Box>
                        <Text fontSize="sm" fontWeight="medium">Public</Text>
                        <Text fontSize="xs" color="gray.400">Visible to all registered players</Text>
                      </Box>
                    </HStack>
                    )}

                    <HStack
                      gap={3} p={3} borderRadius="md" cursor="pointer"
                      bg={!form.isPublic ? "orange.950" : "whiteAlpha.50"}
                      border="1px solid"
                      borderColor={!form.isPublic ? "orange.700" : "whiteAlpha.100"}
                      transition="all 0.15s"
                      onClick={() => set("isPublic", false)}
                    >
                      <Icon as={FaLock} color={!form.isPublic ? "orange.400" : "gray.500"} />
                      <Box>
                        <Text fontSize="sm" fontWeight="medium">Private</Text>
                        <Text fontSize="xs" color="gray.400">Invite-only — share the game link</Text>
                      </Box>
                    </HStack>
                  </Stack>

                  {/* Password (optional regardless of visibility) */}
                  <Box>
                    <Checkbox
                      checked={form.passwordRequired}
                      onChange={(e) => set("passwordRequired", e.target.checked)}
                    >
                      <Text fontSize="sm">Require a password to join</Text>
                    </Checkbox>
                    {form.passwordRequired && (
                      <Input
                        mt={2} type="password" placeholder="Game password"
                        onInput={(e) => set("password", e.target.value)}
                      />
                    )}
                  </Box>
                </Stack>
              </Flex>

              <Separator />

              {/* ── Description ──────────────────────────────────────── */}
              <Box>
                <Text fontSize="sm" mb={1}>Description</Text>
                <Textarea
                  placeholder="Tell players what to expect…"
                  rows={3}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Box>

              {/* ── Recommended addons ───────────────────────────────── */}
              {addons.length > 0 && (
                <>
                  <Separator />
                  <Box>
                    <Text fontSize="sm" mb={3}>Recommended add-ons</Text>
                    <Stack gap={2}>
                      {addons.map((addon) => (
                        <HStack key={addon.id}>
                          <Checkbox
                            onChange={(e) => {
                              const current = form.addonsSelected ?? [];
                              set("addonsSelected", e.target.checked
                                ? [...current, addon.key]
                                : current.filter((x) => x !== addon.key)
                              );
                            }}
                          >
                            <Text fontSize="sm">
                              {addon.name}
                              {addon.description && (
                                <Text as="span" color="gray.400"> — {addon.description}</Text>
                              )}
                            </Text>
                          </Checkbox>
                          {addon.website && (
                            <a href={addon.website} target="_blank" rel="noopener noreferrer">
                              <Icon as={FaLink} color="blue.400" boxSize={3} />
                            </a>
                          )}
                        </HStack>
                      ))}
                    </Stack>
                  </Box>
                </>
              )}
            </Stack>
          </DialogBody>

          <DialogFooter>
            <HStack gap={2}>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                colorPalette="green"
                variant="outline"
                loading={busy}
                onClick={onSubmit}
              >
                <Icon as={FaPlus} mr={1} /> Create game
              </Button>
            </HStack>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </>
  );
};

export default CreateNewDialog;
