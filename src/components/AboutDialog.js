import * as React from "react";
import { Button, Heading, Link, Stack, Text } from "@chakra-ui/react";
import {
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
} from "./ui/dialog";
import { CREDITS } from "./aboutCredits";

export const PROJECT_URL = "https://nordvikmanager.pl";
export const SOURCE_URL = "https://github.com/haffff/NordvikManager";

// The license's additional terms (AGPL-3.0 section 7(b)) require this attribution to stay in
// the UI of every copy, modified or not. Keep it, and the link to the source, when changing it.
export const AboutDialog = ({ openRef }) => {
  const [open, setOpen] = React.useState(false);

  openRef.current = () => setOpen(true);

  return (
    <DialogRoot lazyMount open={open} onOpenChange={(e) => setOpen(e.open)}>
      <DialogBackdrop />
      <DialogContent>
        <DialogCloseTrigger />
        <DialogHeader>
          <Heading size="md">About</Heading>
        </DialogHeader>
        <DialogBody>
          <Stack gap={3}>
            <Text>
              Powered by{" "}
              <Link href={PROJECT_URL} target="_blank" rel="noopener noreferrer" colorPalette="teal">
                NordvikManager
              </Link>
            </Text>
            <Text>Copyright © 2025–2026 haffff</Text>
            <Text fontSize="sm">
              This program is free software, licensed under the GNU Affero General Public License v3
              with an attribution term. You may use, change and share it under that license; a
              changed version you run for others must keep this attribution and offer its source
              code to its users.
            </Text>
            <Link href={SOURCE_URL} target="_blank" rel="noopener noreferrer" colorPalette="teal" fontSize="sm">
              Source code and license
            </Link>
            <Heading size="sm" mt={2}>Built with</Heading>
            <Stack as="ul" gap={1} fontSize="sm" listStyleType="none" m={0} p={0} maxH="40vh" overflowY="auto">
              {CREDITS.map((c) => (
                <Text as="li" key={c.name}>
                  <Link href={c.url} target="_blank" rel="noopener noreferrer" colorPalette="teal">{c.name}</Link>
                  {" "}by {c.by} ({c.license}): {c.what}
                </Text>
              ))}
            </Stack>
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

export default AboutDialog;
