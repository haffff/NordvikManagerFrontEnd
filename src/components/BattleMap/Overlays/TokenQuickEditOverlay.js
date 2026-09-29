import * as React from "react";
import * as ReactDOM from "react-dom";
import ClientMediator from "../../../ClientMediator";
import { useClientMediator } from "../../uiComponents/hooks/useClientMediator";
import UtilityHelper from "../../../helpers/UtilityHelper";
import { resolveTokenParentId, writeTokenProperty } from "./tokenPropertyIO";

/**
 * Investigated/new (see token-features plan item 3): shows small editable
 * fields next to a selected token, for whichever properties its own token
 * template declares via a token-root `editableProps` array — e.g.:
 *   "editableProps": [{ "name": "hp", "dtoProperty": "hp", "label": "HP",
 *                        "source": "card" }]
 * Addon-declared, not hardcoded here — this widget has no knowledge of what
 * "hp" means, only that a field with that config exists.
 */
export const TokenQuickEditOverlay = ({ battleMapId, canvas }) => {
  const [token, setToken] = React.useState(null);
  const [rect, setRect] = React.useState(null);
  const [values, setValues] = React.useState({});
  const [propertyIds, setPropertyIds] = React.useState({});

  const editableProps = token?.tokenData?.editableProps ?? [];

  // Lets other code dismiss/refresh this overlay via ClientMediator, the same
  // way any other panel/service in this codebase is reachable — not just a
  // bare selection-subscribed component with no command surface of its own.
  useClientMediator("BattleMap_tokenQuickEdit", {
    contextId: battleMapId,
    Hide: () => setToken(null),
    Refresh: () => setToken((t) => (t ? { ...t } : t)),
  });

  // ── Selection tracking ────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!battleMapId) return;
    const name = "TokenQuickEditOverlay_" + battleMapId;
    const onSelectionChanged = (event) => {
      const single = event.selected?.length === 1 ? event.selected[0] : null;
      setToken(single?.tokenData?.editableProps?.length ? single : null);
    };
    // Plain sendCommand has no retry/queue — this overlay mounts as a sibling
    // of the canvas, and BMQueryService.Load() (which registers the "BattleMap"
    // panel client) runs from Battlemap.js's own load effect, which (per React's
    // child-before-parent effect ordering) can fire AFTER this component's mount
    // effect. A bare sendCommand here would silently no-op forever if that race
    // loses — sendCommandWaitForRegister(..., true) queues until it registers,
    // matching the established pattern in PropertiesPanel.js.
    ClientMediator.sendCommandWaitForRegister("BattleMap", "SubscribeSelectionChanged", {
      contextId: battleMapId,
      name,
      method: onSelectionChanged,
    }, true);
    return () => {
      // ClientMediator.sendCommand throws when the single client it resolves
      // for this panel+contextId doesn't implement the requested command —
      // "BattleMap"/"battlemap" is a shared bucket (BMQueryService, PopupBMOverlay,
      // TokenIconPickerOverlay, this component all register under it), so an
      // unrelated client can end up as the "sole match" during teardown. This is
      // a best-effort cleanup call — swallow the error rather than let it become
      // an uncaught exception that can break other cleanups in the same commit.
      try {
        ClientMediator.sendCommand("BattleMap", "UnSubscribeSelectionChanged", {
          contextId: battleMapId,
          name,
        });
      } catch (e) {
        console.warn("TokenQuickEditOverlay: UnSubscribeSelectionChanged cleanup failed", e);
      }
    };
  }, [battleMapId]);

  // ── Fetch current values whenever the selected token changes ─────────────
  React.useEffect(() => {
    if (!token || !editableProps.length) {
      setValues({});
      setPropertyIds({});
      return;
    }
    let cancelled = false;
    (async () => {
      const grouped = editableProps.reduce((acc, p) => {
        (acc[p.source] ??= []).push(p);
        return acc;
      }, {});
      const nextValues = {};
      const nextIds = {};
      await Promise.all(
        Object.entries(grouped).map(async ([source, props]) => {
          const parentId = resolveTokenParentId(source, token);
          if (!parentId) return;
          const names = props.map((p) => p.dtoProperty);
          const fetched = await ClientMediator
            .sendCommandAsync("Properties", "GetByNames", { parentId, names })
            .catch(() => []);
          props.forEach((p) => {
            const found = fetched?.find((f) => f.name === p.dtoProperty);
            // The property store round-trips booleans as .NET's bool.ToString()
            // ("True"/"False", PascalCase) — UtilityHelper.ParseBool already
            // normalizes that (and lowercase "true"/"false") case-insensitively.
            nextValues[p.name] = p.type === "boolean"
              ? UtilityHelper.ParseBool(found?.value ?? false)
              : found?.value ?? "";
            if (found?.id) nextIds[p.name] = found.id;
          });
        })
      );
      if (!cancelled) {
        setValues(nextValues);
        setPropertyIds(nextIds);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Screen position tracking ──────────────────────────────────────────────
  // No single Fabric event covers every way a token's on-screen position can
  // change (move, scale, pan, zoom) — a light rAF loop while a token is shown
  // is simpler and correctness-safe for one small overlay, and doubles as the
  // "did this token get deleted while selected" check.
  React.useEffect(() => {
    if (!token || !canvas) {
      setRect(null);
      return;
    }
    let raf;
    const tick = () => {
      if (!canvas.getObjects().includes(token)) {
        setToken(null);
        return;
      }
      setRect(token.getBoundingRect(false, true));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [token, canvas]);

  const commit = (field, value) => {
    writeTokenProperty({
      token,
      source: field.source,
      dtoProperty: field.dtoProperty,
      value,
      existingId: propertyIds[field.name],
    });
  };

  if (!token || !rect || !canvas?.wrapperEl) return null;

  return ReactDOM.createPortal(
    <div
      // Mounted via portal into canvas.wrapperEl (Fabric's own `.canvas-container`
      // div, already `position: relative`) — token.getBoundingRect(false, true)
      // returns coordinates already accounting for the current pan/zoom
      // (viewportTransform), relative to that same element's origin, so no
      // separate coordinate-conversion math is needed here.
      style={{
        position: "absolute",
        left: rect.left + rect.width + 6,
        top: rect.top,
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        gap: "3px",
        padding: "6px 8px",
        background: "rgba(20,20,20,0.85)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: "4px",
        pointerEvents: "auto",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {editableProps.map((field) => (
        <label
          key={field.name}
          style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#eee" }}
        >
          <span style={{ minWidth: "48px" }}>{field.label ?? field.name}</span>
          {field.type === "boolean" ? (
            // A checkbox has no "blur to commit" idiom — commit immediately on
            // toggle, matching how a checkbox is expected to behave.
            <input
              type="checkbox"
              checked={values[field.name] === true}
              onChange={(e) => {
                setValues((prev) => ({ ...prev, [field.name]: e.target.checked }));
                commit(field, e.target.checked);
              }}
            />
          ) : (
            <input
              style={{ width: "60px", fontSize: "11px", padding: "1px 4px" }}
              value={values[field.name] ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
              onBlur={(e) => commit(field, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.target.blur();
              }}
            />
          )}
        </label>
      ))}
    </div>,
    canvas.wrapperEl
  );
};

export default TokenQuickEditOverlay;
