import { Box, Image} from '@chakra-ui/react';
import * as React from 'react';

import '../../stylesheets/player.css';

export const PlayerAvatar = ({ player, size }) => {
    let imageSize = size === undefined ? 50 : size
    return (
        <Box className='nm_player_avatar' width={imageSize} height={imageSize} backgroundColor={player?.color ? player?.color : player?.Color} >
            <Image className='nm_player_avatar_image' src={player?.image} />
        </Box>
    );
}
export default PlayerAvatar;