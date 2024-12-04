import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import React from "react";
import { FaMinus } from "react-icons/fa";
import DListItem from "./base/List/DListItem";
import DListItemsButtonContainer from "./base/List/DListItemsButtonContainer";
import DListItemButton from "./base/List/ListItemDetails/DListItemButton";
import Subscribable from "./base/Subscribable";
import DList from "./base/List/DList";
import PlayerAvatar from "./PlayerAvatar";
import ClientMediator from "../../ClientMediator";

export const PlayerChooser = ({
  onSelect,
  multipleSelection,
  selectedPlayers,
  isDisabled,
}) => {
  const [_selectedPlayers, setSelectedPlayers] = React.useState([]);
  const [players, setPlayers] = React.useState(false);
  const [selectedOptions, setSelectedOptions] = React.useState(undefined);

  const LoadData = (then) => {
    const players = ClientMediator.sendCommand("Game", "GetPlayers", {});
    setPlayers(players);
    setSelectedPlayers(players.filter((x) => selectedPlayers.includes(x.id)));
  };

  const selectedPlayersRef = React.useRef(_selectedPlayers);
  selectedPlayersRef.current = _selectedPlayers;

  React.useEffect(() => {
    LoadData();
  }, []);

  const [showSelect, setShowSelect] = React.useState(false);

  return (
    <Box>
      <Subscribable onMessage={LoadData} commandPrefix={"player"} />

      {_selectedPlayers &&
        _selectedPlayers.map((player) => (
          <DListItem width={"300px"} key={player.id}>
            <PlayerAvatar player={player} />
            <Text marginLeft={"15px"}>{player.name}</Text>

            <DListItemsButtonContainer>
              <DListItemButton
                isDisabled={isDisabled}
                icon={FaMinus}
                color={"red"}
                onClick={() => {
                  setSelectedPlayers(
                    _selectedPlayers.filter((x) => x.id !== player.id)
                  );
                  onSelect(
                    _selectedPlayers
                      .filter((x) => x.id !== player.id)
                      .map((x) => x.id)
                  );
                }}
              />
            </DListItemsButtonContainer>
          </DListItem>
        ))}

      {showSelect ? (
        <>
          <Stack maxH={"300px"} overflow={"auto"}>
            <DList>
              {players.map((player) => {
                return (
                    <DListItem
                    isSelected={
                        selectedOptions?.includes(player)
                    }
                    width={"300px"}
                    onClick={() => {
                        if (multipleSelection) {
                            if (selectedOptions.includes(player)) {
                                setSelectedOptions(
                                    selectedOptions.filter((x) => x.id !== player.id)
                                );
                            } else {
                                setSelectedOptions([..._selectedPlayers, player]);
                            }
                        } else {
                            setSelectedOptions([player]);
                        }
                    }}
                    >
                    <PlayerAvatar player={player} />
                    <Text marginLeft={"15px"}>{player.name}</Text>
                  </DListItem>
                );
              })}
            </DList>
          </Stack>
          <Button
            marginTop={5}
            isDisabled={isDisabled}
            size={"xs"}
            onClick={() => {
                onSelect(selectedOptions.map((x) => x.id));
                setSelectedPlayers([...selectedOptions]);
                setShowSelect(false);
            }}
          >
            Select
          </Button>
        </>
      ) : (
        <Button
          size={"xs"}
          marginTop={"5px"}
          onClick={() => {
            setSelectedOptions([..._selectedPlayers]);
            setShowSelect(true);
          }}
        >
          Select Player{multipleSelection ? "s" : ""}
        </Button>
      )}
    </Box>
  );
};

export default PlayerChooser;
