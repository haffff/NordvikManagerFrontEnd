import { ActiveWebHelper as WebHelper } from "./transport";
import emptyImageDefault from "../assets/system/empty-image.svg";
import emptyTokenImageDefault from "../assets/system/empty-token.svg";
import emptyAvatarImageDefault from "../assets/system/empty-avatar.svg";

// Well-known per-game Resource keys (see MaterialsController Resource/CreateResource/
// ResourceData). A GM can override any of these for their game by uploading a file
// under the matching key (SystemAssetsSettingsPanel) — until they do, every game gets
// the bundled default below via resolveSystemAssetUrl()/fallback wiring.
export const SYSTEM_ASSET_KEYS = Object.freeze({
  EMPTY_IMAGE: "emptyImage",
  EMPTY_TOKEN_IMAGE: "emptyTokenImage",
  EMPTY_AVATAR_IMAGE: "emptyAvatarImage",
  CHAT_MESSAGE_SOUND: "chatMessageSound",
});

// key -> bundled fallback asset. CHAT_MESSAGE_SOUND intentionally has no bundled
// default yet — picking a notification sound is a product/content decision, not
// something to synthesize here. Drop a file at src/assets/system/chat-message.mp3
// and add it here to enable one; until then only a GM-uploaded override plays.
export const SYSTEM_ASSET_DEFAULTS = Object.freeze({
  [SYSTEM_ASSET_KEYS.EMPTY_IMAGE]: emptyImageDefault,
  [SYSTEM_ASSET_KEYS.EMPTY_TOKEN_IMAGE]: emptyTokenImageDefault,
  [SYSTEM_ASSET_KEYS.EMPTY_AVATAR_IMAGE]: emptyAvatarImageDefault,
});

// key -> Promise<string url>, resolved once per game session so every
// token/avatar/etc. that needs the same fallback reuses one WebRTC round-trip
// instead of each re-fetching it.
const _resolvedUrlCache = new Map();

// Keys FabricTypesInitializer has already confirmed have no per-game override
// this session — lets it skip straight to the bundled default instead of
// re-hitting the (400-ing) WebRTC endpoint for every imageless token.
const _missingKeys = new Set();
export function isKnownMissing(key) {
  return _missingKeys.has(key);
}
export function markMissing(key) {
  _missingKeys.add(key);
}

/**
 * Resolves a system asset key to a usable <img>/fabric src: the GM's per-game
 * override if they've uploaded one under this key, otherwise the bundled default
 * (or undefined if the key has no bundled default and no override exists).
 */
export function resolveSystemAssetUrl(key) {
  if (_resolvedUrlCache.has(key)) return _resolvedUrlCache.get(key);

  const bundled = SYSTEM_ASSET_DEFAULTS[key];
  const promise = WebHelper.getResourceBlobAsync(null, key)
    .then((blob) => (blob instanceof Blob ? URL.createObjectURL(blob) : bundled))
    .catch(() => bundled);

  _resolvedUrlCache.set(key, promise);
  return promise;
}

/** Call after a GM uploads/replaces an override so the new file is picked up
 * within the same session instead of waiting for a reload. */
export function invalidateSystemAsset(key) {
  _resolvedUrlCache.delete(key);
  _missingKeys.delete(key);
  WebHelper.clearResourceCache?.();
}

/**
 * Plays a system sound key (GM override if set, else bundled default if one
 * exists). No-ops silently if neither is available — same "nothing to show"
 * philosophy as ResourceImage's optional fallbackSrc.
 */
export async function playSystemSound(key) {
  try {
    const url = await resolveSystemAssetUrl(key);
    if (!url) return;
    const audio = new Audio(url);
    audio.play()?.catch((e) => {
      console.warn(`[systemAssets] audio.play() blocked for "${key}":`, e?.message ?? e);
    });
  } catch (e) {
    console.warn(`[systemAssets] failed to resolve sound "${key}":`, e?.message ?? e);
  }
}
