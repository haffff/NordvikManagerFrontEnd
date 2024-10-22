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
  Text,
  WrapItem,
} from "@chakra-ui/react";
import { IoIosSettings } from "react-icons/io";

const GameListItem = ({ game, onClick }) => {
  return (
    <WrapItem>
      <Card
      justify={'center'}
        width={200}
        height={350}
        maxW="sm"
        key={game.id}
        bgColor={game.color}
      >
        <CardBody>
          <Flex direction={'column'} padding='5' justify={'center'} gap={'15px'}>
          <Heading size={'md'}>{game.name}</Heading>
          <Image boxSize={100} fit={'contain'} src={game.image} alt={game.name} />
          <Divider />
          {game.shortDescription}
          </Flex>
        </CardBody>
        <CardFooter gap={'10px'}>
          <Button
            key={game.id}
            onClick={() => {
              onClick(game.id);
            }}
          >
            <p>Join</p>
          </Button>
          {game.isOwner? <IconButton icon={<IoIosSettings />} onClick={() => {}} /> : <></>}
        </CardFooter>
      </Card>
    </WrapItem>
  );
};

export default GameListItem;
