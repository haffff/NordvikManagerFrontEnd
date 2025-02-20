import { Box } from "@chakra-ui/react";
import "../../../stylesheets/panel.css";
import { Tooltip } from "../../ui/tooltip";

export const DWrapItem = (props) => {
  return (
    <Tooltip content={props.tooltip}>
      <Box 
        className={props.isSelected ? "nm_dwrapitem_selected" : "nm_dwrapitem"}
        boxSize={"50px"}
        {...props}
      >
        {props.children}
      </Box>
    </Tooltip>
  );
};
