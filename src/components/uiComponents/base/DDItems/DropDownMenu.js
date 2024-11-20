import { Button, Icon, Stack, Table, Tr } from '@chakra-ui/react';
import * as React from 'react';
import { IoIosArrowDropdown } from 'react-icons/io';
import DropDownButton from './DropDrownButton';

export const DropDownMenu = ({ children, name, submenu, width, icon, onDropDown, expandableWithAction, expandableLocationName, state }) => {
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

    const HandleNewMenuButton = (data) => {
        if (data.command === "add_menu_button" && data.data.Location === expandableLocationName && !additionalItems.includes(data.data.UiName)) {

            setAdditionalItems([...additionalItems, data.data]);
        }
    }

    return (
        <div width={width} onMouseLeave={MouseLeave} style={{ margin: 0 }}>
            <DropDownButton name={name} icon={icon}
                width={width} size="sm" onMouseEnter={MouseEnter} onClick={() => setDropdown(true)} rightIcon={submenu ? <Icon as={IoIosArrowDropdown} /> : undefined} dropdown={true} />
            <Stack
                width={width} >
                <div style={{ backgroundColor: 'rgb(40,40,40)', display: dropdown ? 'inline' : 'none', marginTop: submenu ? -29 : undefined, position: 'absolute', 'marginLeft': submenu ? width : 0, width: width, zIndex: 999 }} ref={ref}>
                    {children}
                    {
                        expandableWithAction ? (
                            <>
                                {/* <Subscribable commandPrefix={"add_menu_button"} onMessage={HandleNewMenuButton} />
                                {additionalItems.filter(x => !additionalItems.onlyOwner).map((x) => <CreateDropDownButton width={150} name={x.Name} state={state} element={<CustomPanel uiName={x.UiName} />} />)}
                                <OnlyOwner>
                                    {additionalItems.filter(x => additionalItems.onlyOwner).map((x) => <CreateDropDownButton width={150} name={x.Name} state={state} element={<CustomPanel uiName={x.UiName} />} />)}
                                </OnlyOwner> */}
                            </>) : <></>
                    }
                </div>
            </Stack>
        </div>
    );
}
export default DropDownMenu;