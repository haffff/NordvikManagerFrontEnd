import { Box } from "@chakra-ui/react";

export const DialogContainer = (props) => {
  return (
    <Box pointerEvents={props.open ? 'all' : 'none'} top={0} left={0} position="absolute" w={"100vw"} h={"100vh"} {...props}>
      {props.children}
    </Box>
  );
};
