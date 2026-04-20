import { fabric } from 'fabric';
import ArrowTypeInit from "./uiComponents/fabricjs/ArrowType";
import ConeTypeInit from "./uiComponents/fabricjs/ConeType";
import { ActiveWebHelper } from '../helpers/transport';

// ── Helpers ──────────────────────────────────────────────────────────────────

function _isBackendResourceUrl(url) {
  return typeof url === 'string' && url.includes('/Materials/Resource');
}

function _extractResourceParams(url) {
  try {
    const qs = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
    const p = new URLSearchParams(qs);
    return { id: p.get('id') || undefined, key: p.get('key') || undefined };
  } catch {
    return {};
  }
}

// ── Override 1: fabric.util.loadImage ────────────────────────────────────────
//
// fabric.Image.fromURL and loadFromJSON both funnel through fabric.util.loadImage.
// When the URL points at the GM backend's material endpoint, a direct HTTP fetch
// would 401 for players (no session cookie). Strategy:
//   1. Try fetching the binary via WebRTC (cached per session in WebRTCWebHelper).
//   2. On success: wrap in a blob URL, hand to original loadImage, revoke AFTER
//      the callback has finished (fabric must see the img before we revoke).
//   3. On failure: log a warning and call the callback with null (fabric will use a placeholder).
//
if (fabric.util?.loadImage) {
  const _originalLoadImage = fabric.util.loadImage.bind(fabric.util);

  fabric.util.loadImage = function (url, callback, context, crossOrigin) {
    if (!_isBackendResourceUrl(url)) {
      return _originalLoadImage(url, callback, context, crossOrigin);
    }

    const { id, key } = _extractResourceParams(url);
    if (!id && !key) {
      return _originalLoadImage(url, callback, context, crossOrigin);
    }

    ActiveWebHelper.getResourceBlobAsync(id, key)
      .then((blob) => {
        if (!blob || !(blob instanceof Blob)) {
          console.warn(`[FabricLoader] WebRTC fetch returned no blob for id=${id} key=${key} — image will not display`);
          if (callback) callback.call(context, null);
          return;
        }

        const blobUrl = URL.createObjectURL(blob);
        _originalLoadImage(
          blobUrl,
          (img) => {
            // Call callback FIRST so fabric.Image is fully set up, THEN revoke.
            if (callback) callback.call(context, img);
            URL.revokeObjectURL(blobUrl);
          },
          context,
          crossOrigin,
        );
      })
      .catch((err) => {
        console.warn(`[FabricLoader] WebRTC fetch failed for id=${id} key=${key} — image will not display`, err);
        if (callback) callback.call(context, null);
      });
  };
}

// ── Override 2: fabric.Image.prototype.toObject ───────────────────────────────
//
// Don't persist src for resource-backed images. DTOConverter.ConvertFromDTO
// reconstructs src from resourceId / resourceKey on every load, so storing it
// is redundant and produces stale values (blob:// URLs, gameid=undefined).
//
if (fabric.Image?.prototype) {
  const _originalImageToObject = fabric.Image.prototype.toObject;
  fabric.Image.prototype.toObject = function (propertiesToInclude) {
    const obj = _originalImageToObject.call(this, propertiesToInclude);
    if (this.resourceId || this.resourceKey) {
      delete obj.src;
    }
    return obj;
  };
}

// ── Entry point ───────────────────────────────────────────────────────────────

const FabricTypesInitialize = () => {
  ArrowTypeInit();
  ConeTypeInit();
};

export default FabricTypesInitialize;
