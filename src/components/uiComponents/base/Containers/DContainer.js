import { Flex, IconButton, Stack } from '@chakra-ui/react';
import * as React from 'react';
import DListItemButton from '../List/ListItemDetails/DListItemButton';
import { FaMinus } from 'react-icons/fa';
import DLabel from '../Text/DLabel';

export const DContainer = ({ children, maxHeight, maxWidth, height, width, backgroundColor, title, withVisibilityToggle, collapsed }) => {
    const [visible, setVisible] = React.useState(!collapsed);
    let visibilityToggle = (<></>);

    if (withVisibilityToggle) {
        visibilityToggle = (<DListItemButton size={'xs'} onClick={() => {}} icon={FaMinus} />);
    }

    return (
        <Stack height={height} maxHeight={maxHeight} width={width} overflowY={'auto'} maxWidth={maxWidth} backgroundColor={backgroundColor} paddingTop={'5px'} borderWidth={'1px'} borderColor={'rgb(70,70,70)'} borderRadius={'5px'}>
            {title && !visibilityToggle ? <DLabel>{title}</DLabel> : <></>}
            {visibilityToggle ?
                <Flex onClick={() => setVisible(!visible)} direction={'row-reverse'}>
                    {visibilityToggle}
                    <Flex paddingLeft={'15px'} grow={1}><DLabel>{title}</DLabel></Flex>
                </Flex> : <></>
            }
            <Stack padding={'10px'} margin={'5px'} display={visible ? 'inherit' : 'none'}>
                {children}
            </Stack>
        </Stack>
    );
}
export default DContainer;