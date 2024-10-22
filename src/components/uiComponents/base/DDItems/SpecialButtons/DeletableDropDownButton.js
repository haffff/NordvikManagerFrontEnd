import { Box, Button, Center, Icon, IconButton, Menu, Stack, Td } from '@chakra-ui/react';
import * as React from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import { IoMdClose } from 'react-icons/io';

export const DeletableDropDownButton = ({ name, icon, onClick, onDeleteClick, width, height }) => {

    return (
        <div>
            <Box
                as='button'
                height={height !== undefined ? height : '25px'}
                lineHeight='1.2'
                transition='all 0.2s cubic-bezier(.08,.52,.52,1)'
                border='1px'
                name='parent'
                px='8px'
                width={width}
                marginRight={-2}
                borderRadius='2px'
                fontSize='14px'
                bg='rgb(50,50,50)'
                overflow='hidden'
                color='#ffffff'
                borderColor='rgb(90,90,90)'
                _hover={{ bg: 'rgb(70,70,70)' }}
                _active={{
                    bg: 'rgb(90,90,90)',
                    transform: 'scale(0.98)',
                    borderColor: '#bec3c9',
                }}
                _focus={{
                    boxShadow:
                        '0 0 1px 2px rgba(88, 144, 255, .75), 0 1px 1px rgba(0, 0, 0, .15)',
                }}
                onClick={(e) => {if(e.target.nodeName === "TD") onClick(e)}}
            >
                <table style={{ 'margin': 0 }}>
                    <tbody>
                    <tr>
                        <td width='15px' style={{ alignItems: 'left' }}>
                            {icon !== undefined ? <Icon as={icon} /> : <></>}
                        </td>
                        <td width={width - 30}>
                            {name}
                        </td>
                        <td style={{ verticalAlign: 'bottom' }}>
                            <Button onClick={onDeleteClick} colorScheme="alpha" size='xs'>
                                <Center><Icon color={'white'} as={IoMdClose} /></Center>
                            </Button>
                        </td>
                    </tr>
                    </tbody>
                </table>
            </Box>
        </div>
    );
}
export default DeletableDropDownButton;