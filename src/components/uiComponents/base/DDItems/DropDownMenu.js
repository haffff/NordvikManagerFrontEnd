import { Button, Icon, Stack, Table, Tr } from '@chakra-ui/react';
import * as React from 'react';
import { IoIosArrowDropdown } from 'react-icons/io';
import DropDownButton from './DropDrownButton';
import ClientMediator from '../../../../ClientMediator';

export const DropDownMenu = ({ children, name, submenu, width, icon, onDropDown, gmOnly, viewId }) => {
    const [dropdown, setDropdown] = React.useState(false);
    const [additionalItems, setAdditionalItems] = React.useState([]);
    let ref = React.useRef();

    React.useEffect(() => {
        const handler = (event) => {
            if (dropdown && ref.current && !ref.current.contains(event.target)) {
                setDropdown(false);
                onDropDown && onDropDown();
            }
        };
        document.addEventListener("mousedown", handler);
        document.addEventListener("touchstart", handler);
        return () => {
            // Cleanup the event listener
            document.removeEventListener("mousedown", handler);
            document.removeEventListener("touchstart", handler);
        };
        
    }, [dropdown]);

    React.useEffect(() => {
        if(viewId)
        {
            ClientMediator.register({
                panel: "DropDownMenu",
                id: viewId,
                contextId: viewId,
                AddMenuItem: (item) => {
                    setAdditionalItems([...additionalItems, item]);
                }
            });
        }
    },[]);

    if(gmOnly && localStorage.getItem("gmMode") !== "true")
    {
        return null;
    }

    let dropdownOpenEvent = () => setDropdown(true)
    let dropdownCloseEvent = () => setDropdown(false)
    let dropdownOpenTimeout = undefined;
    let dropdownCloseTimeout = undefined;

    const MouseEnter = () => {
        dropdownOpenTimeout = setTimeout(dropdownOpenEvent, 500);

        if (dropdownCloseTimeout !== undefined) {
            clearTimeout(dropdownCloseTimeout);
        }
    }

    const MouseLeave = () => {
        if (dropdownOpenTimeout !== undefined) {
            clearTimeout(dropdownOpenTimeout);
        }
        dropdownOpenTimeout = setTimeout(dropdownCloseEvent, 200);
    }

    return (
        <div width={width} onMouseLeave={MouseLeave} style={{ margin: 0 }}>
            <DropDownButton name={name} icon={icon}
                width={width} size="sm" onMouseEnter={MouseEnter} onClick={() => setDropdown(true)} rightIcon={submenu ? <Icon as={IoIosArrowDropdown} /> : undefined} dropdown={true} />
            <Stack
                width={width} >
                <div style={{ backgroundColor: 'rgb(40,40,40)', display: dropdown ? 'inline' : 'none', marginTop: submenu ? -29 : undefined, position: 'absolute', 'marginLeft': submenu ? width : 0, width: width, zIndex: 999 }} ref={ref}>
                    {children}
                    {additionalItems}
                </div>
            </Stack>
        </div>
    );
}
export default DropDownMenu;