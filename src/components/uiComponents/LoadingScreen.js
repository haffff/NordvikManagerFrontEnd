import { Fade, Spinner, Stack } from "@chakra-ui/react";
import "../../stylesheets/generic.css";

export const LoadingScreen = ({ children }) => {
  return (
    // <Fade in out duration={0.5} unmountOnExit>
      <div className="loading-screen">
        <div className="loading-screen-inner">
          <Stack>
            <Spinner
              thickness="4px"
              speed="0.65s"
              emptyColor="gray.200"
              color="blue.500"
              size="xl"
            />
            Loading...
          </Stack>
        </div>
      </div>
    // </Fade>
  );
};
