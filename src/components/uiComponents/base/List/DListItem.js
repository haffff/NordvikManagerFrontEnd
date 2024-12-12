import { Card, Flex } from "@chakra-ui/react";
import * as React from "react";

import "../../../../stylesheets/panel.css";

export const DListItem = (props) => {
  const { isSelected, children, onClick, width, withHover, flexProps } = props;
  let className = "nm_dlistitem_card";
  if(withHover){
    className += " nm_dlistitem_card_hover";
  }


  return (
    <Flex className="nm_dlistitem">
      <Card {...props}
        onClick={onClick}
        size="sm"
        className={
          isSelected ? "nm_dlistitem_card_selected" : className
        }
      >
        <Flex
          grow={1}
          alignItems={"center"}
          justifyItems={"center"}
          verticalAlign={"middle"}
            {...flexProps}
        >
          {children}
        </Flex>
      </Card>
    </Flex>
  );
};
export default DListItem;
