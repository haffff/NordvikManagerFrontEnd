import { Card, Flex } from "@chakra-ui/react";
import * as React from "react";

import "../../../../stylesheets/panel.css";

export const DListItem = (props) => {
  // Only isSelected/withHover/flexProps are this component's own custom props;
  // width is a legitimate Card.Root/Chakra prop, so it's left in domProps.
  const { isSelected, children, onClick, withHover, flexProps, ...domProps } = props;
  let className = "nm_dlistitem_card";
  if(withHover){
    className += " nm_dlistitem_card_hover";
  }

  // TODO Make it better
  return (
    <Flex className="nm_dlistitem">
      <Card.Root {...domProps}
        onClick={onClick}
        size="sm"
        className={
          isSelected ? "nm_dlistitem_card_selected" : className
        }
        bg={isSelected && "var(--nordvik-selection-color)"}
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
      </Card.Root>
    </Flex>
  );
};
export default DListItem;
