// An <img src> for a GM-backend resource URL. A GM server serves it over HTTP; in the host build
// the backend is in this tab, which an <img> can't reach: the URL is fetched (hostFetch answers
// it) and shown as a blob: URL.
import { useEffect, useState } from 'react';
import { isHostMode } from '../helpers/appMode';

export function useResourceUrl(url) {
  const host = isHostMode();
  const [blobUrl, setBlobUrl] = useState(null);
  useEffect(() => {
    if (!host || !url) return undefined;
    let live = true;
    let made = null;
    fetch(url)
      .then((resp) => (resp.ok ? resp.blob() : null))
      .then((blob) => {
        if (!live || !blob) return;
        made = URL.createObjectURL(blob);
        setBlobUrl(made);
      })
      .catch(() => {});
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [host, url]);
  return host ? blobUrl : url;
}
