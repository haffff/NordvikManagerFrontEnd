import { RESERVED_LAYERS } from "../../Constants/layers";

// ─── Constants ────────────────────────────────────────────────────────────────

export const TOKEN_UI_LAYER = RESERVED_LAYERS.TOKEN_UI;

export const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns true if value is a bare GUID, false if it's a named/scoped key. */
export const _isGuid = (value) => GUID_RE.test(value ?? "");
