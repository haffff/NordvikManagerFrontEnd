import { Button, Flex, HStack, Input, Wrap, WrapItem } from "@chakra-ui/react";
import React from "react";
import { FaSearch } from "react-icons/fa";
import * as icons from 'react-icons/gi';
import DynamicIcon from "./DynamicIcon";
import { IconBase } from "react-icons";

const GameIcons = Object.keys(icons);

export const DynamicIconChooser = ({ onSelect, iconSelected, isDisabled }) => {
    const [filter, setFilter] = React.useState("");
    const [selectedIcon, setSelectedIcon] = React.useState(iconSelected);
    const [showSelect, setShowSelect] = React.useState(false);
    const [showAll, setShowAll] = React.useState(false);

    const AmountToShow = 21;


    const getIcons = () => {
        if(showAll)
        {
            return Object.values(icons).filter(x => x.name.includes(filter));
        }

        let filteredIcons = GameIcons.filter(x => x.includes(filter));
        let list = [];
        for (let index = 0; index < AmountToShow; index++) {
            filteredIcons[index] && list.push(icons[filteredIcons[index]]);
        }
        return list;
    }

    return (
        <>
            {selectedIcon && <DynamicIcon iconProps={{size:55}} iconName={selectedIcon} />}

            {showSelect ?
                <><Flex><FaSearch /><Input size={'xs'} onChange={(e) => setFilter(e.target.value)} /></Flex>
                    <HStack wrap='wrap' overflowY={'auto'} height={'200px'}>
                        {getIcons().map((Icon) => (<Flex align='flex-start' onClick={() => { setSelectedIcon(Icon.name); setShowSelect(false); if(onSelect) onSelect(Icon.name); }}><Icon size='40' /></Flex>))}
                    </HStack> 
                    <Button isDisabled={isDisabled} width={45} size={'xs'} onClick={() => setShowAll(!showAll)}>{showAll ? "Less..." : "More..."}</Button></>
                : <Button isDisabled={isDisabled} size={'xs'} onClick={() => {setShowSelect(true); setShowAll(false);}}>Select Icon</Button> }
        </>
    );
}

export default DynamicIconChooser;