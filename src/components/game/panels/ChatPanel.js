import * as React from "react";
import { Textarea, Flex, Heading, Badge, Input, For } from "@chakra-ui/react";
import {
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "../../ui/select";
import Loadable from "../../uiComponents/base/Loadable";
import * as Dockable from "@hlorenzi/react-dockable";
import WebHelper from "../../../helpers/WebHelper";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import WebSocketManagerInstance from "../WebSocketManager";
import Subscribable from "../../uiComponents/base/Subscribable";
import BasePanel from "../../uiComponents/base/BasePanel";
import DListItem from "../../uiComponents/base/List/DListItem";
import PlayerAvatar from "../../uiComponents/PlayerAvatar";
import DListItemButton from "../../uiComponents/base/List/ListItemDetails/DListItemButton";
import { FaSearch } from "react-icons/fa";
import DLabel from "../../uiComponents/base/Text/DLabel";
import DContainer from "../../uiComponents/base/Containers/DContainer";
import DropDownButton from "../../uiComponents/base/DDItems/DropDrownButton";
import useGame from "../../uiComponents/hooks/useGameHook";
import CommandExecutionHelper from "../../../helpers/CommandExecutionHelper";
import { LoadingScreen } from "../../uiComponents/LoadingScreen";

export const ChatPanel = () => {
  const [items, setItems] = React.useState([]);
  const [newItem, setNewItem] = React.useState(undefined);
  const [message, setMessage] = React.useState(undefined);
  const [reachedTop, setReachedTop] = React.useState(undefined);
  const [toolTip, setToolTip] = React.useState(undefined);
  const [reloadChat, setReloadChat] = React.useState(false);
  const [loadedPages, setLoadedPages] = React.useState(0);

  const [filter, setFilter] = React.useState(undefined);
  const [from, setFrom] = React.useState(undefined);
  const [searchOptions, setSearchOptions] = React.useState(false);
  //const [, forceUpdate] = React.useReducer(x => x + 1, 0);
  const reloadRef = React.useRef(undefined);

  const game = useGame();

  const ctx = Dockable?.useContentContext();
  ctx?.setTitle(`Chat`);

  if (game === undefined) {
    return <></>;
  }

  if (newItem !== undefined) {
    setItems([newItem, ...items]);
    setNewItem(undefined);
  }

  const OnMessage = (event) => {
    setNewItem(event);
  };

  // const OnPlayer = (event) => {
  //     if (event.command === "player_join")
  //         setNewItem({ data: `${event.data.Name} has joined the game` });
  //     if (event.command === "player_leave")
  //         setNewItem({ data: `${event.data.Name} has left the game` });
  // }

  const Load = (finished) => {
    WebHelper.get(
      `battlemap/getchat`,
      (x) => {
        setItems(x);
        finished();
      },
      finished
    );
  };

  const HandleSend = () => {
    if (message === undefined || message === "") {
      return;
    }

    if (message.startsWith("/c ")) {
      let cmessage = message.replace("/c ", "");
      CommandExecutionHelper.LoadSuggestions();
      let result = CommandExecutionHelper.RunCommand(cmessage);
      if (result !== undefined) {
        if (typeof result === "object") {
          result = JSON.stringify(result);
        } else {
          result = result.toString();
        }
        setNewItem({ data: result });
      } else {
        setNewItem({ data: "Executed " + cmessage });
      }
      setMessage("");
      return;
    }

    let command = CommandFactory.CreateChatSendCommand(message);
    WebSocketManagerInstance.Send(command);

    setMessage("");
  };

  const AppendChat = () => {
    let args = `page=${loadedPages + 1}`;

    if (filter) {
      args += `&filter=${filter}`;
    }

    if (from && from !== "Any") {
      args += `&from=${from}`;
    }

    WebHelper.get(`battlemap/getchat?${args}`, (x) => {
      if (x.length !== 0) {
        setItems([...items, ...x]);
        setLoadedPages(loadedPages + 1);
      } else {
        setReachedTop(true);
      }
    });
  };

  if (reloadChat) {
    let args = `gameID=${game.id}`;

    if (filter) {
      args += `&filter=${filter}`;
    }

    if (from && from !== "Any") {
      args += `&from=${from}`;
    }

    WebHelper.get(
      `battlemap/getchat?${args}`,
      (x) => {
        setReachedTop(false);
        setLoadedPages(0);
        setItems(x);
        setReloadChat(false);
      },
      () => {}
    );
  }

  let lastPlayer = undefined;

  // TO BE MOVED TO PARSER
  function ParseMessage(message) {
    let list = message.split("|");
    let elementsList = list.map((element) => {
      let obj = undefined;
      if (element.startsWith("[b]")) {
        let msg = element.replace("[b]", "");
        let additionalColor = msg.startsWith("[g]")
          ? "green"
          : msg.startsWith("[r]")
          ? "red"
          : "purple";
        obj = (
          <Badge colorScheme={additionalColor}>
            {msg.replace("[g]", "").replace("[r]", "")}
          </Badge>
        );
      }

      // else if (element.startsWith("[a]")) {
      //     obj = (<a href='' >{element.replace("[a]", "")}</a>);
      // }
      else {
        obj = <>{element}</>;
      }
      return obj;
    });

    return elementsList;
  }

  const CreateChatMessage = (x, nextX) => {
    let message = x.data;
    let elementsList = <></>;
    if (message !== undefined) {
      elementsList = ParseMessage(message);
    }
    let player = game.players.find((y) => x.playerId == y.id); //.name;

    let showLabel = x.playerId !== nextX?.playerId;

    lastPlayer = player;
    return (
      <>
        <DListItem
          isSelected={
            player !== undefined && player.id === game.CurrentPlayerId
          }
        >
          {elementsList}
        </DListItem>
        {!showLabel ? (
          <></>
        ) : (
          <Flex
            marginLeft={"25px"}
            direction="row"
            alignItems={"center"}
            justifyItems={"center"}
            verticalAlign={"middle"}
          >
            {player && <PlayerAvatar size={"25px"} player={player} />}
            <Heading size="sm">{player?.name || "[No longer exists]"}</Heading>
          </Flex>
        )}
      </>
    );
  };

  const OnPlayerSettings = (event) => {
    let player = game.players.find((x) => x.id === event.data.id);
    if (player) {
      player.name = event.data.name;
      player.color = event.data.color;
      player.image = event.data.image;
    }
  };

  return (
    <Loadable OnLoad={Load}>
      <Subscribable
        commandPrefix="settings_player"
        onMessage={OnPlayerSettings}
      />
      <Subscribable commandPrefix="chat" onMessage={OnMessage} />
      <BasePanel>
        <Flex
          grow={1}
          direction="column-reverse"
          overflowY="auto"
          overflowX="hidden"
          onScroll={(e) => {
            if (
              e.currentTarget.scrollTop +
                e.currentTarget.scrollHeight -
                e.currentTarget.clientHeight <
                3 &&
              !reachedTop
            ) {
              AppendChat();
            }
          }}
          scrollBehavior=""
        >
          {items.map((a, i) => CreateChatMessage(a, items[i + 1]))}
        </Flex>
        <Flex
          direction="column"
          style={{ display: searchOptions ? "block" : "none" }}
        >
          <DContainer>
            <DLabel>Search By: </DLabel>
            <Input
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setReloadChat(true);
              }}
            />
            <DLabel>From: </DLabel>
            <SelectRoot
              onChange={(e) => {
                setFrom(e.target.value);
                setReloadChat(true);
              }}
              multiple={false}
              value={from}
            >
              <SelectLabel />
              <SelectTrigger>
                <SelectValueText placeholder="Any" />
              </SelectTrigger>
              {/* <SelectContent>
                <For each={game.players} fallback={<LoadingScreen />}>
                  {(x) => (
                    <SelectItem
                      item={x}
                      value={x.id || x.Id}
                      key={x.id || x.Id}>
                      {x.name || x.Name}
                    </SelectItem>
                  )}
                </For>
              </SelectContent> */}
            </SelectRoot>
          </DContainer>
        </Flex>
        <Flex direction="row">
          <DListItemButton
            icon={FaSearch}
            onClick={() => setSearchOptions(!searchOptions)}
          />
          <Textarea
            onKeyDown={(e) => {
              if (e.key == "Enter") {
                e.preventDefault();
                HandleSend();
              }
            }}
            onChange={(t) => setMessage(t.target.value)}
            value={message}
            resize={"none"}
          ></Textarea>
          <DropDownButton name={"Send"} onClick={HandleSend} height={75} />
        </Flex>
      </BasePanel>
    </Loadable>
  );
};
export default ChatPanel;
