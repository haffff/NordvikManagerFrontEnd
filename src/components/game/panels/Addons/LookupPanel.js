import * as React from 'react';
import { Flex, FormLabel, HStack, Image, Textarea } from '@chakra-ui/react'
import * as Dockable from "@hlorenzi/react-dockable"
import Subscribable from '../../../uiComponents/base/Subscribable';
import DList from '../../../uiComponents/base/List/DList';
import DContainer from '../../../uiComponents/base/Containers/DContainer';
import DListItem from '../../../uiComponents/base/List/DListItem';
import DText from '../../../uiComponents/base/Text/DText';
import DListItemButton from '../../../uiComponents/base/List/ListItemDetails/DListItemButton';
import { FaEye } from 'react-icons/fa';
import DLabel from '../../../uiComponents/base/Text/DLabel';
import { JSONTree } from 'react-json-tree';
import BasePanel from '../../../uiComponents/base/BasePanel';
import WebHelper from '../../../../helpers/WebHelper';

export const LookupPanel = ({ name, content, contentType }) => {
    //let gameData = gamedata.current;
    if (contentType === undefined) {
        contentType = "object";
    }

    const [loadedData, setLoadedData] = React.useState(undefined);

    const forceUpdate = React.useReducer(x => x + 1, 0)[1];

    const ctx = Dockable.useContentContext();
    ctx.setTitle(name);

    let elementToShow = undefined;
    switch (contentType) {
        case "text/json":
        case "application/json":
        case 9:
            try {
                let newContent = JSON.parse(content);
                elementToShow = <JSONTree data={newContent} />;
            }
            catch (e) {
                elementToShow = <>{content}</>;
            }
            break;
        case "object":
            elementToShow = <JSONTree data={content} />;
            break;
        case "text/plain":
        case "text/css":
        case "text/html":
        case "text/javascript":
        case "text/markdown":
        case "text/xml":
        case "text/csv":
        case 7:
        case 8:
        case 10:
            elementToShow = <>{content}</>;
            break;
        case "image/png":
        case "image/jpeg":
        case "image/gif":
        case 0:
        case 1:
        case 2:
        case 3:
            elementToShow = <Image src={content} />;
            break;
        case "audio/mp3":
        case "audio/wav":
        case "audio/ogg":
        case 4:
        case 5:
        case 6:
            elementToShow = <audio controls src={content} />;
            break;
        default:
            elementToShow = <>{content}</>;
            break;
    }

    return (
        <BasePanel>
            <DContainer height={'100%'} width={'100%'}>
                {elementToShow}
            </DContainer>
        </BasePanel>
    )
}
export default LookupPanel;