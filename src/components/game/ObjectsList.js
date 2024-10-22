import * as React from 'react';
import { Checkbox, Tr, Td, Table, Tbody } from '@chakra-ui/react'
import { Icon } from '@chakra-ui/react'
import { FaSquare, FaCircle, FaWindowMinimize, FaMousePointer, FaHandPaper, FaShapes, FaTextHeight, FaImage } from 'react-icons/fa'

export const ObjectsList = ({ game, map, canvasEditor }) => {
    const [selectedItem, setSelectedItem] = React.useState(undefined);
    const [userSelectedItem, setUserSelectedItem] = React.useState(undefined);
    const [items, setItems] = React.useState(undefined);

    React.useEffect((e) => {
        if (selectedItem !== undefined && selectedItem !== null && canvasEditor !== undefined) {
            canvasEditor.canvas.setActiveObject(selectedItem);
            canvasEditor.canvas.requestRenderAll();
        }
    }, [userSelectedItem]);

    const handleChecking = (event, element) => {
        element.visible = event.target.checked;
        canvasEditor.canvas.fire("element:updated", { target: element });
    }

    const GetProperIcon = (type) => {
        switch (type) {
            case 'rect':
                return FaSquare;
            case 'circle':
                return FaCircle;
            case 'textbox':
            case 'text':
                return FaTextHeight;
            case 'image':
                return FaImage;
            default:
                return undefined;
        }
    }

    return (
        <div title="Objects" name="ObjectsList" >
            <Table size={'sm'}>
                <Tbody>
                    {items !== undefined ? items.map(element => {
                        if(element.name !== undefined && element.name.startsWith("."))
                            return;

                        let color = 'gray';
                        if (selectedItem !== undefined && selectedItem !== null) {
                            color = selectedItem.get('id') === element.id ? 'white' : 'gray'
                        }
                        return (<Tr key={element.id} bg={color} onClick={() => { setSelectedItem(element); setUserSelectedItem(element); }}>
                            <Td><Checkbox defaultChecked={element.visible} onChange={(e) => handleChecking(e, element)}></Checkbox></Td>
                            <Td>{element.name}</Td>
                            <Td><Icon as={GetProperIcon(element.type)} /></Td>
                        </Tr>);
                    }) : <></>}
                </Tbody>
            </Table>
        </div>
    )

    function RefreshItems(e) {
        setSelectedItem(canvasEditor.canvas.getActiveObject());
        setItems(canvasEditor.canvas.getObjects());
    }
}
export default ObjectsList;