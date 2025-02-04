import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Divider,
  Flex,
  Heading,
  IconButton,
  Image,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  WrapItem,
  useDisclosure,
} from "@chakra-ui/react";
import { IoIosSettings, IoMdMore } from "react-icons/io";
import WebHelper from "../../helpers/WebHelper";
import React from "react";

const GameListItem = ({ game, onClick }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedSettingsGame, setSelectedSettingsGame] = React.useState(undefined);

  const DeleteGame = (gameID) => {
    WebHelper.post("gamelist/deletegame", { gameID: gameID }, () => {
      onClose();
    });
  }

  return (
    <WrapItem>
      <Card
        justify={"center"}
        width={200}
        height={350}
        maxW="sm"
        key={game.id}
        bgColor={game.color}
      >
        <CardBody>
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
            <Divider />
            {game.shortDescription}
          </Flex>
        </CardBody>
        <CardFooter gap={"10px"}>
          <Button
            key={game.id}
            onClick={() => {
              onClick(game.id);
            }}
          >
            <p>Join</p>
          </Button>
          {game.isOwner ? (
            <IconButton icon={<IoMdMore />} onClick={() => {
              setSelectedSettingsGame(game);
              onOpen();
            }} />
          ) : (
            <></>
          )}
        </CardFooter>
      </Card>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Game Settings</ModalHeader>
          <ModalBody>
            <Flex direction={"column"} gap={"10px"}>
              <Heading size={"md"}>{selectedSettingsGame?.name}</Heading>
              <Text>{selectedSettingsGame?.description}</Text>
              <Divider />
              <Button colorScheme="red" onClick={() => window.confirm("Are you sure?") ? DeleteGame(game.id) : undefined}>
                <p>Delete Game</p>
              </Button>
            </Flex>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </WrapItem>
  );
};

export default GameListItem;
