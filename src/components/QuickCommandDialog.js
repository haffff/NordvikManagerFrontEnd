import * as React from "react";
import {
  Box,
  Button,
  Divider,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import CommandExecutionHelper from "../helpers/CommandExecutionHelper";
import DockableHelper from "../helpers/DockableHelper";
import LookupPanel from "./game/panels/Addons/LookupPanel";

export const QuickCommandDialog = ({ state, openRef, onCloseModal }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [command, setCommand] = React.useState("");
  const [suggestions, setSuggestions] = React.useState([]);
  const initialRef = React.useRef();
  const stackRef = React.useRef();
  openRef.current = onOpen;
  //Check why ref is not working here

  React.useEffect(() => {
    CommandExecutionHelper.LoadSuggestions();
  }, [isOpen]);

  React.useEffect(() => {
    setSuggestions(CommandExecutionHelper.GetSuggestions(command));
  }, [command]);

  function RunCommand() {
    let result = CommandExecutionHelper.RunCommand(command);
    if (result !== undefined) {
      DockableHelper.NewFloating(state,
        <LookupPanel
          name={`${command} result`}
          content={result}
        ></LookupPanel>
      );
    }
  }

  return (
    <Modal
      blockScrollOnMount={false}
      isOpen={isOpen}
      onClose={onClose}
      initialFocusRef={initialRef}
      size={"4xl"}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Run command</ModalHeader>
        <ModalCloseButton />
        <ModalBody marginBottom={"20px"}>
          <HStack>
            <Input
              onKeyDown={(e) => {
                //on arrow down
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  stackRef.current.firstChild.focus();
                }
                if (e.key === "Enter") {
                  //run command
                  RunCommand();
                  onClose();
                }
              }}
              ref={initialRef}
              placeholder="Command"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
            />
            <Button
              colorScheme="blue"
              mr={3}
              onClick={(e) => {
                //run command
                RunCommand();
                onClose();
              }}
            >
              Run
            </Button>
          </HStack>
          <Divider margin={"10px"} />
          <Stack ref={stackRef}>
            {suggestions.map((suggestion) => (
              <Box
                as="button"
                padding={"5px"}
                key={suggestion.panel + "." + suggestion.command}
                backgroundColor={"gray"}
                onKeyDown={(e) => {
                  //on arrow down
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    if(e.target.nextSibling)
                      e.target.nextSibling.focus();
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    if(e.target.previousSibling)
                      e.target.previousSibling.focus();
                  }
                }}
                onClick={(e) => {
                  setCommand(suggestion.panel + "." + suggestion.command);
                  initialRef.current.focus();
                }}
              >
                <HStack gap={1}>
                  <Text color="darkgray">{suggestion.panel}.</Text>
                  <Text fontWeight={"bold"}>{suggestion.command}</Text>
                  {suggestion?.requiresContext && (
                    <Text color="darkgray" fontStyle={'italic'}>(Bm context required)</Text>
                  )}
                </HStack>
              </Box>
            ))}
          </Stack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
export default QuickCommandDialog;
