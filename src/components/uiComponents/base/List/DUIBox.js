import { Box } from "@chakra-ui/react";

export const DUIBox = (props) => {
  return (
    <Box
      margin={"5px"}
      padding={"15px"}
      borderRadius={"5px"}
      bgColor={"gray.800"}
      {...props}
    >
      {props.children}
    </Box>
  );
};
