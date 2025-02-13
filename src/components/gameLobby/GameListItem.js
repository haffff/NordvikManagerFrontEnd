import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Dialog,
  Flex,
  Heading,
  IconButton,
  Image,
  Separator,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { IoIosSettings, IoMdMore } from "react-icons/io";
import WebHelper from "../../helpers/WebHelper";
import React from "react";
import { DialogContainer } from "../uiComponents/base/Containers/DialogContainer";
import { DialogBackdrop, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogRoot } from "../ui/dialog";

const GameListItem = ({ game, onClick, reload }) => {
  const [open, setOpen] = React.useState(false);
  const [selectedSettingsGame, setSelectedSettingsGame] =
    React.useState(undefined);

  const DeleteGame = async (gameID) => {
    await WebHelper.deleteAsync("gamelist/deletegame?gameId=" + gameID, { gameID: gameID });
    setOpen(false);
    reload();
  };

  return (
    <Flex align={"flex-start"}>
        <DialogRoot open={open} onOpenChange={(e) => setOpen(e.open)}>
          <DialogBackdrop />
          <DialogContent>
            <DialogHeader>Game Settings</DialogHeader>
            <DialogBody>
              <Flex direction={"column"} gap={"10px"}>
                <Heading size={"md"}>{selectedSettingsGame?.name}</Heading>
                <Text>{selectedSettingsGame?.description}</Text>
                <Separator />
                <Button
                  colorPalette={"red"}
                  variant={"outline"}
                  onClick={() =>
                    window.confirm("Are you sure?")
                      ? DeleteGame(game.id)
                      : undefined
                  }
                >
                  <p>Delete Game</p>
                </Button>
              </Flex>
            </DialogBody>
            <DialogFooter>
              <Button variant={"outline"} onClick={() => setOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogRoot>
      <Card.Root
        justify={"center"}
        width={200}
        height={350}
        maxW="sm"
        key={game.id}
        bgColor={game.color}
      >
        <Card.Body>
          <Flex
            direction={"column"}
            padding="5"
            justify={"center"}
            gap={"15px"}
          >
            <Heading size={"md"}>{game.name}</Heading>
            <Image
              boxSize={100}
              fit={"contain"}
              src={WebHelper.getResourceString(game.image, undefined, game.id)}
              alt={game.name}
            />
            <Separator />
            {game.shortDescription}
          </Flex>
        </Card.Body>
        <Card.Footer gap={"10px"}>
          <Button
            variant={"outline"}
            key={game.id}
            onClick={() => {
              onClick(game.id);
            }}
          >
            <p>Join</p>
          </Button>
          {game.isOwner ? (
            <IconButton
              variant={"outline"}
              onClick={() => {
                setSelectedSettingsGame(game);
                setOpen(true);
              }}
            >
              <IoMdMore />
            </IconButton>
          ) : (
            <></>
          )}
        </Card.Footer>
      </Card.Root>
    </Flex>
  );
};

export default GameListItem;
