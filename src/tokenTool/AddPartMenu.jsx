import * as React from "react";
import { IconButton, Text } from "@chakra-ui/react";
import { FaPlus } from "@react-icons/all-files/fa/FaPlus";
import { MenuContent, MenuItem, MenuItemGroup, MenuRoot, MenuTrigger } from "../components/ui/menu";
import { PATTERNS } from "./patterns";
import { PART_MIME } from "./dragDrop";

// The token editor's "+": the one-click parts by what they're for. An entry can also be
// dragged onto the preview, to add the part where it is dropped.

const CATEGORIES = [
  ["Values", [["bar", "A value against its max, e.g. HP"], ["label", "Text from a property, e.g. the name"]]],
  ["Status", [["iconSet", "Icons shown while a yes/no property is on"], ["ring", "A circle around the token, coloured by a value"]]],
  ["Interaction", [["button", "Click to open the card or run an action"]]],
  ["Shapes", [["rect", "A box: a frame, a marker, a badge behind a label"], ["circle", "A dot or a disc"], ["polygon", "A triangle, a hexagon, a star base"]]],
];

export function AddPartMenu({ onAdd }) {
  return (
    <MenuRoot onSelect={({ value }) => onAdd(value)} positioning={{ placement: "bottom-start" }}>
      <MenuTrigger asChild>
        <IconButton size="xs" variant="outline" aria-label="Add part" title="Add part">
          <FaPlus />
        </IconButton>
      </MenuTrigger>
      <MenuContent minW="260px" zIndex={9999}>
        {CATEGORIES.map(([title, items]) => (
          <MenuItemGroup key={title} title={title}>
            {items.map(([id, description]) => (
              <MenuItem
                key={id}
                value={id}
                draggable="true"
                onDragStart={(e) => {
                  e.dataTransfer.setData(PART_MIME, id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                cursor="grab"
                flexDirection="column"
                alignItems="flex-start"
                gap="0"
              >
                <Text fontSize="sm">{PATTERNS[id].title}</Text>
                <Text fontSize="xs" color="fg.muted">{description}</Text>
              </MenuItem>
            ))}
          </MenuItemGroup>
        ))}
      </MenuContent>
    </MenuRoot>
  );
}

export default AddPartMenu;
