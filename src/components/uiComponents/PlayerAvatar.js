import { Box, Image} from '@chakra-ui/react';
import * as React from 'react';

export const PlayerAvatar = ({ player, size }) => {
    let imageSize = size === undefined ? 50 : size
    return (
        <Box padding={1} width={imageSize} height={imageSize} margin={1} backgroundColor={player?.color ? player?.color : player?.Color} >
            <Image src={player?.image} objectFit={'cover'} />
        </Box>
    );
}
export default PlayerAvatar;