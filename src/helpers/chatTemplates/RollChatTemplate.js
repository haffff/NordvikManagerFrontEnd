import { Box, Flex } from "@chakra-ui/react";

export const RollChatTemplate = ({ object }) => {
  if (!object || !object.roll) {
    return null;
  }
  const { title, roll, borderColor, color, message } = object;
  const { rolled, result, dices } = roll;

  const constructFunction = (rolled, dices) => {
    const constructColorBox = (index, result, value) => {
      const isCritical = result === value;
      const isFail = result === 1;
      return (
        <Box
          key={"roll_dice_" + index}
          color={isCritical ? "green" : isFail ? "red" : "white"}
        >
          {result}
        </Box>
      );
    };

    const regexSplit = /(\w+)|(\{\d+\})/g;
    const splittedRolled = rolled.split(regexSplit).filter(Boolean);
    let elementsArray = [];

    splittedRolled.forEach((element) => {
      if (element.startsWith("{") && element.endsWith("}")) {
        //trim from { and }
        const trimmedElement = element.substring(1, element.length - 1);
        const index = parseInt(trimmedElement);

        const dicesFiltered = dices.filter((x) => x.index === index);

        if (dicesFiltered.length === 1) {
          //One dice ( example {0} = d20 or {0} = 1d20)
          const dice = dicesFiltered[0];
          
          elementsArray.push(
            constructColorBox(index, dice.result, dice.diceValue)
          );
        } else {
          // Many dices ( example {0} = 4d20 )
          let subElementsArray = ["("];
          dicesFiltered.forEach((dice, index) => {
            subElementsArray.push(
                constructColorBox(index, dice.result, dice.diceValue)
            );
            if (index !== dicesFiltered.length - 1) {
              subElementsArray.push(" + ");
            }
          });
          subElementsArray.push(")");

            elementsArray.push(
                <Flex key={"roll_dice_" + index} color="white">
                {subElementsArray}
                </Flex>
            );
        }
      } else {
        // non dice (example: '+', '-', '(', ')')
        elementsArray.push(element);
      }
    });
    return elementsArray;
  };

  const elements = constructFunction(rolled, dices);

  return (
    <Box>
      <Flex>{elements}{" "}=</Flex> {result}
    </Box>
  );
};
