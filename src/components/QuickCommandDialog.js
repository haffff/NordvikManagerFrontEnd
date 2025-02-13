import * as React from "react";
import {
  Box,
  Button,
  For,
  HStack,
  Input,
  Separator,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import CommandExecutionHelper from "../helpers/CommandExecutionHelper";
import DockableHelper from "../helpers/DockableHelper";
import LookupPanel from "./game/panels/Addons/LookupPanel";
import { DialogBackdrop, DialogBody, DialogCloseTrigger, DialogContent, DialogHeader, DialogRoot } from "./ui/dialog";


export const QuickCommandDialog = ({ state, openRef, onCloseModal }) => {
  const [open, setOpen] = React.useState(false);
  const [command, setCommand] = React.useState("");
  const [suggestions, setSuggestions] = React.useState([]);
  const initialRef = React.useRef();
  const stackRef = React.useRef();
  openRef.current = () => setOpen(true);
  //Check why ref is not working here

  React.useEffect(() => {
    CommandExecutionHelper.LoadSuggestions();
  }, [open]);

  React.useEffect(() => {
    setSuggestions(CommandExecutionHelper.GetSuggestions(command));
  }, [command]);

  function RunCommand() {
    let result = CommandExecutionHelper.RunCommand(command).then((result) => {
      if (result !== undefined) {
        DockableHelper.NewFloating(
          state,
          <LookupPanel
            name={`${command} result`}
            content={result}
          ></LookupPanel>
        );
      }
    });
  }

  return (
      <DialogRoot
        blockScrollOnMount={false}
        open={open}
        onOpenChange={(e) => setOpen(e.open)}
        initialFocusRef={initialRef}
        size={"xl"}
      >
        <DialogBackdrop />
        <DialogContent>
          <DialogHeader>Run command</DialogHeader>
          <DialogCloseTrigger />
          <DialogBody marginBottom={"20px"}>
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
                    setOpen(false);
                  }
                }}
                ref={initialRef}
                placeholder="Command"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
              />
              <Button
                variant={"outline"}
                mr={3}
                onClick={(e) => {
                  //run command
                  RunCommand();
                  setOpen(false);
                }}
              >
                Run
              </Button>
            </HStack>
            <Separator margin={"10px"} />
            <Stack ref={stackRef}>
              <For each={suggestions} fallback={<Text>No suggestions</Text>}>
              {(suggestion) => (
                <Box
                  as="button"
                  padding={"5px"}
                  key={suggestion.panel + "." + suggestion.command}
                  onKeyDown={(e) => {
                    //on arrow down
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      if (e.target.nextSibling) e.target.nextSibling.focus();
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      if (e.target.previousSibling)
                        e.target.previousSibling.focus();
                    }
                  }}
                  onClick={(e) => {
                    setCommand(suggestion.panel + "." + suggestion.command);
                    initialRef.current.focus();
                  }}
                >
                  <HStack gap={1}>
                    <Text>{suggestion.panel}.</Text>
                    <Text fontWeight={"bold"}>{suggestion.command}</Text>
                    {suggestion?.requiresContext && (
                      <Text fontStyle={"italic"}>
                        (Bm context required)
                      </Text>
                    )}
                  </HStack>
                </Box>
              )}
              </For>
            </Stack>
          </DialogBody>
        </DialogContent>
      </DialogRoot>
  );
};
export default QuickCommandDialog;
