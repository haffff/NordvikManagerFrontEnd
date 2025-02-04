import { Box, Image} from '@chakra-ui/react';
import * as React from 'react';

import '../../stylesheets/player.css';
import WebHelper from '../../helpers/WebHelper';

export const PlayerAvatar = ({ player, size }) => {
    let imageSize = size === undefined ? 50 : size
    return (
        <Box className='nm_player_avatar' width={imageSize} height={imageSize} backgroundColor={player?.color ? player?.color : player?.Color} >
            <Image className='nm_player_avatar_image' src={WebHelper.getResourceString(player?.image || player?.Image)} />
        </Box>
    );
}
export default PlayerAvatar;