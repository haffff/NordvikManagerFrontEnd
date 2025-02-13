import * as React from 'react';
import ContextMenu from './DDItems/ContextMenu';

export const ContextMenuArea = ({ children, target , id , contextMenuItems }) => {
    const [rightClickLocation,setRightClickLocation] = React.useState([0,0]);
    const [dropdown, setDropdown] = React.useState(false);

    React.useEffect(() => {
        const handler = (event) => {
            if (dropdown && event.target.nodeName != "TD") {
                setDropdown(false);
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

    return (
        <div 
            onContextMenu={(e) => {
            e.preventDefault();
            let rect = e.target.getBoundingClientRect();
            let localLocationX = e.pageX - rect.left;
            let localLocationY = e.pageY - rect.top;
            setRightClickLocation([localLocationX, localLocationY]);
            setDropdown(true);
          }}
          >
                {children}
                <ContextMenu id={id} location={rightClickLocation} isOpen={dropdown}>
                    {contextMenuItems}
                </ContextMenu>
        </div>
    );
}
export default ContextMenu;