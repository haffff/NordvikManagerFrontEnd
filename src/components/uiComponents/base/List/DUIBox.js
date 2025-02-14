import { Box, Flex } from "@chakra-ui/react";

export const DUIBox = (props) => {
  return (
    <Flex
      direction={'column'}
      margin={"5px"}
      padding={"15px"}
      borderRadius={"5px"}
      gap={"10px"}
      {...props}
    >
      {props.children}
    </Flex>
  );
};
