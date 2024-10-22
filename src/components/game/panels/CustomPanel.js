import * as React from 'react';
import WebHelper from '../../../helpers/WebHelper';
import BasePanel from '../../uiComponents/base/BasePanel';
import * as Dockable from "@hlorenzi/react-dockable";
import Subscribable from '../../uiComponents/base/Subscribable';
import WebSocketManagerInstance from '../WebSocketManager';
import CollectionSyncer from '../../uiComponents/base/CollectionSyncer';

export const CustomPanel = ({ gameDataManagerRef, uiName }) => {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    const [card, setCard] = React.useState(null);
    const [data, setData] = React.useState({});
    const [lastEdited, setLastEdited] = React.useState(undefined);
    const [properties, setProperties] = React.useState([]);
    const dataRef = React.useRef(data);
    dataRef.current = data;

    const ctx = Dockable.useContentContext();

    React.useEffect(() => {
        WebHelper.get("addon/customPanel?gameid=" + gameDataManagerRef.current?.Game?.id + "&uiname=" + uiName, (response) => {
            try {
                response.content = JSON.parse(response.content);
            }
            catch (e) {
                console.log(e);
            }
            WebHelper.get("properties/GetProperties?gameid=" + gameDataManagerRef.current?.Game?.id + "&parentId=" + response.id, (props) => {
                setProperties([...props]);
                setCard(response);
            }, (error) => console.log(error));
        }, (error) => console.log(error));
    }, []);

    React.useEffect(() => {
        if (lastEdited) {
            let property = properties.find(x => x.id === lastEdited.id);
            if(property)
            {
                WebSocketManagerInstance.Send({ command: "property_update", data: property });
            }
            else
            {
                WebSocketManagerInstance.Send({ command: "property_add", data: lastEdited });
            }
        }
    }, [lastEdited]);

    if (card) {
        ctx.setTitle(card.name);
    }
    else {
        return <>Not Found</>;
    }

    const HandleIncomingMessage = (response) => {
        setData({ canEdit: card.permission & 8, canExecute: card.permission & 2, ...data, ...response.data });
    }

    return (
        <BasePanel>
            {card?.dataCommandPrefix ? <Subscribable commandPrefix={card.dataCommandPrefix} onMessage={HandleIncomingMessage} /> : <CollectionSyncer commandPrefix={"property"} collection={properties} setCollection={setProperties} />}
            
        </BasePanel>
    )
}
export default CustomPanel;