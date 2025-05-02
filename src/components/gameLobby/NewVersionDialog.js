import * as React from "react";
import {
  Button,
  ButtonGroup,
  Box,
  Dialog,
  Text,
  Heading,
  List,
} from "@chakra-ui/react";
import {
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogHeader,
  DialogRoot,
} from "../ui/dialog";

export const NewVersionDialog = ({ open, versionInfo, onClose }) => {
  React.useEffect(() => {}, []);

  return (
    <DialogRoot lazyMount open={open}>
      <DialogBackdrop />
      <DialogContent>
        <DialogCloseTrigger />
        <DialogHeader>
          <Heading>New version is here!</Heading>
        </DialogHeader>
        <DialogBody>
          <Box>
            <Text>
              Current Version: <b>{versionInfo && versionInfo.version}</b>
            </Text>
            <Text>
              Latest Version: <b>{versionInfo && versionInfo.currentVersion}</b>
            </Text>
            <Box margin={5}>
              <Heading>Release Notes:</Heading>
              <List.Root>
                {versionInfo?.changes?.map((x) => (
                  <List.Item>{x}</List.Item>
                ))}
              </List.Root>
            </Box>
          </Box>
        </DialogBody>
        <Dialog.Footer>
          <ButtonGroup>
            <Button
              onClick={() => {
                window.open(
                  "https://github.com/haffff/NordvikManager/releases"
                );
              }}
            >
              Download
            </Button>
            <Button onClick={() => onClose()}>Close</Button>
          </ButtonGroup>
        </Dialog.Footer>
      </DialogContent>
    </DialogRoot>
  );
};
