import * as React from 'react';
import { Flex, Icon } from '@chakra-ui/react';
import { FaInfoCircle } from 'react-icons/fa';
import { Tooltip } from '../../ui/tooltip';

// Resolves a doc link against the Central server's Docusaurus site
// (REACT_APP_CENTRAL_URL) unless it's already an absolute URL — mirrors the
// existing "smart URL builder" convention (e.g. TokenManager.js's
// _toResourceUrl) so field/panel definitions can just say "/documentation/x".
function resolveDocUrl(docUrl) {
  if (/^https?:\/\//i.test(docUrl)) return docUrl;
  return `${process.env.REACT_APP_CENTRAL_URL ?? ''}${docUrl}`;
}

/**
 * Single "?"-style help affordance, shared by field-level tooltips
 * (EditTable.js, SettingsPanel.js) and panel-level help (BasePanel.js).
 *
 * - `text` alone: hover-only tooltip, non-interactive (cursor: help).
 * - `text` + `docUrl`: same hover tooltip, but the icon also becomes
 *   clickable and opens the resolved doc link in a new tab.
 * - No `text`: renders nothing, matching the prior EditTable.js convention
 *   of not showing an icon when there's nothing to say.
 */
export const HelpIcon = ({ text, docUrl }) => {
  if (!text) return null;

  const hasLink = Boolean(docUrl);

  return (
    <Tooltip content={text} positioning={{ placement: 'top' }} openDelay={200}>
      <Flex
        as="span"
        data-testid="help-icon"
        align="center"
        cursor={hasLink ? 'pointer' : 'help'}
        color="gray.500"
        _hover={{ color: 'blue.300' }}
        display="inline-flex"
        onClick={hasLink ? () => window.open(resolveDocUrl(docUrl), '_blank', 'noopener,noreferrer') : undefined}
      >
        <Icon as={FaInfoCircle} boxSize="11px" />
      </Flex>
    </Tooltip>
  );
};

export default HelpIcon;
