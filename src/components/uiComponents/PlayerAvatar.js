import { Box, Flex, Text } from '@chakra-ui/react';

import '../../stylesheets/player.css';
import ResourceImage from './ResourceImage';
import { Tooltip } from '../ui/tooltip';
import { SYSTEM_ASSET_KEYS, SYSTEM_ASSET_DEFAULTS } from '../../helpers/systemAssets';

export const PlayerAvatar = ({ player, size, showTooltip = true }) => {
    const imageSize = size === undefined ? 50 : size
    const imageSizeCss = typeof imageSize === "number" ? `${imageSize}px` : imageSize

    const avatar = (
        <Box
            className='nm_player_avatar'
            width={imageSizeCss}
            height={imageSizeCss}
            overflow="hidden"
            borderRadius="md"
            backgroundColor={player?.color ? player?.color : player?.Color}
        >
            <ResourceImage
                className='nm_player_avatar_image'
                id={player?.image || player?.Image}
                resourceKey={SYSTEM_ASSET_KEYS.EMPTY_AVATAR_IMAGE}
                fallbackSrc={SYSTEM_ASSET_DEFAULTS[SYSTEM_ASSET_KEYS.EMPTY_AVATAR_IMAGE]}
                width="100%"
                height="100%"
                aspectRatio="1 / 1"
                objectFit="cover"
                objectPosition="center"
            />
        </Box>
    );

    if (!showTooltip || !player) return avatar;

    const name = player?.name ?? player?.Name ?? "Unknown";

    return (
        <Tooltip
            openDelay={1000}
            closeDelay={0}
            contentProps={{
                bg: "var(--nordvik-secondary-color)",
                color: "var(--nordvik-text-color)",
            }}
            content={
                <Flex direction="column" alignItems="center" gap="4px" p="2px">
                    <Box borderRadius="md" overflow="hidden" backgroundColor={player?.color ? player?.color : player?.Color}>
                        <ResourceImage
                            id={player?.image || player?.Image}
                            resourceKey={SYSTEM_ASSET_KEYS.EMPTY_AVATAR_IMAGE}
                            fallbackSrc={SYSTEM_ASSET_DEFAULTS[SYSTEM_ASSET_KEYS.EMPTY_AVATAR_IMAGE]}
                            height="200px"
                        />
                    </Box>
                    <Text fontSize="12px" fontWeight="medium">{name}</Text>
                </Flex>
            }
        >
            {avatar}
        </Tooltip>
    );
}
export default PlayerAvatar;
