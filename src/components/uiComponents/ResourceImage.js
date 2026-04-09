import React, { useState, useEffect } from 'react';
import { Image } from '@chakra-ui/react';
import { ActiveWebHelper } from '../../helpers/transport';

/**
 * Renders a resource image by fetching it via WebRTC (ActiveWebHelper.getResourceBlobAsync)
 * and mounting it as a blob URL. Falls back to nothing if the fetch fails.
 * Use this instead of <Image src={WebHelper.getResourceString(id)}> anywhere players
 * need to see resource images (players have no HTTP session cookie for the GM backend).
 */
const ResourceImage = ({ id, resourceKey, fallbackSrc, ...props }) => {
  const [blobSrc, setBlobSrc] = useState(null);

  useEffect(() => {
    if (!id && !resourceKey) return;

    let mounted = true;
    let objectUrl = null;

    ActiveWebHelper.getResourceBlobAsync(id, resourceKey)
      .then((blob) => {
        if (!mounted || !(blob instanceof Blob)) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobSrc(objectUrl);
      })
      .catch((e) => {
        if (mounted) console.warn('[ResourceImage] fetch error for id=' + id, e);
      });

    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, resourceKey]);

  const src = blobSrc || fallbackSrc;
  if (!src) return null;
  return <Image src={src} {...props} />;
};

export default ResourceImage;
