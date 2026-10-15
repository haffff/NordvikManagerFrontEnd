import * as React from 'react';
import DropDownButton from '../DropDrownButton';
import { FaCheck } from '@react-icons/all-files/fa/FaCheck';

export const ToggableDropDownButton = ({ name, onClick, width, isToggled }) => {
    return (
            <DropDownButton width={width} icon={isToggled ? FaCheck : undefined} onClick={onClick} name={name} />
    );
}
export default ToggableDropDownButton;