import * as React from "react";
import * as ReactDOM from "react-dom";
import ClientMediator from "../../../ClientMediator";
import { useClientMediator } from "../../uiComponents/hooks/useClientMediator";
import UtilityHelper from "../../../helpers/UtilityHelper";
import { resolveTokenParentId, writeTokenProperty } from "./tokenPropertyIO";

/**
 * A small gear next to the selected token opens compact editable fields, for
 * whichever properties its own token template declares via a token-root
 * `editableProps` array — e.g.:
 *   "editableProps": [{ "name": "hp", "dtoProperty": "hp", "label": "HP",
 *                        "source": "card" }]
 * Addon-declared, not hardcoded here — this widget has no knowledge of what
 * "hp" means, only that a field with that config exists. Fields sharing a
 * `group` (e.g. a bar's value and max) sit on one row.
 *
 * Closed until the gear is clicked (it used to open on every selection, bigger
 * than the token itself); Esc, a click outside, or deselecting closes it, and the
 * gear and panel step aside while the token is dragged.
 */
export const TokenQuickEditOverlay = ({ battleMapId, canvas }) => {
  const [token, setToken] = React.useState(null);
  const [rect, setRect] = React.useState(null);
  const [values, setValues] = React.useState({});
  const [propertyIds, setPropertyIds] = React.useState({});
  const [open, setOpen] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const panelRef = React.useRef(null);
  const gearRef = React.useRef(null);

  const editableProps = token?.tokenData?.editableProps ?? [];

  // Lets other code dismiss/refresh this overlay via ClientMediator, the same
  // way any other panel/service in this codebase is reachable — not just a
  // bare selection-subscribed component with no command surface of its own.
  useClientMediator("BattleMap_tokenQuickEdit", {
    contextId: battleMapId,
    Hide: () => setToken(null),
    // Re-fetch the values. (Replacing the token with a copy, as before, lost the
    // Fabric object it stands for, so the overlay closed instead.)
    Refresh: () => setRefreshKey((k) => k + 1),
  });

  // ── Selection tracking ────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!battleMapId) return;
    const name = "TokenQuickEditOverlay_" + battleMapId;
    const onSelectionChanged = (event) => {
      const single = event.selected?.length === 1 ? event.selected[0] : null;
      setToken(single?.tokenData?.editableProps?.length ? single : null);
      setOpen(false);
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
  }, [token, refreshKey]);

  // ── Screen position tracking ──────────────────────────────────────────────
  // No single Fabric event covers every way a token's on-screen position can
  // change (move, scale, pan, zoom) — a light rAF loop while a token is shown
  // is simpler and correctness-safe for one small overlay, and doubles as the
  // "did this token get deleted while selected" check. It only sets state when
  // the token actually moved on screen; it used to re-render every frame.
  React.useEffect(() => {
    if (!token || !canvas) {
      setRect(null);
      return;
    }
    let raf;
    let last = null;
    const tick = () => {
      if (!canvas.getObjects().includes(token)) {
        setToken(null);
        return;
      }
      const r = token.getBoundingRect(false, true);
      if (!last || r.left !== last.left || r.top !== last.top || r.width !== last.width || r.height !== last.height) {
        last = r;
        setRect(r);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [token, canvas]);

  // ── Step aside while the token is dragged ────────────────────────────────
  React.useEffect(() => {
    if (!token || !canvas?.on) return;
    const involves = (target) =>
      target === token || (target?.type === "activeSelection" && target.getObjects?.().includes(token));
    const onMoving = (e) => {
      if (involves(e?.target)) setDragging(true);
    };
    const onDone = () => setDragging(false);
    canvas.on("object:moving", onMoving);
    canvas.on("object:modified", onDone);
    canvas.on("mouse:up", onDone);
    return () => {
      canvas.off("object:moving", onMoving);
      canvas.off("object:modified", onDone);
      canvas.off("mouse:up", onDone);
      setDragging(false);
    };
  }, [token, canvas]);

  // ── Esc or a click outside closes the panel ──────────────────────────────
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target) || gearRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const commit = (field, value) => {
    writeTokenProperty({
      token,
      source: field.source,
      dtoProperty: field.dtoProperty,
      value,
      existingId: propertyIds[field.name],
    });
  };

  if (!token || !rect || !canvas?.wrapperEl || dragging) return null;

  // Fields sharing a `group` (a bar's value and max) share a row, labelled by its first field.
  const rows = [];
  editableProps.forEach((field) => {
    const row = field.group ? rows.find((r) => r.group === field.group) : null;
    if (row) row.fields.push(field);
    else rows.push({ group: field.group, label: field.label ?? field.name, fields: [field] });
  });
  const hasIcons = (token.tokenData?.assignableIcons?.length ?? 0) > 0;

  const renderInput = (field) =>
    field.type === "boolean" ? (
      // A checkbox has no "blur to commit" idiom — commit immediately on toggle.
      <input
        type="checkbox"
        aria-label={field.label ?? field.name}
        checked={values[field.name] === true}
        onChange={(e) => {
          setValues((prev) => ({ ...prev, [field.name]: e.target.checked }));
          commit(field, e.target.checked);
        }}
      />
    ) : (
      <input
        aria-label={field.label ?? field.name}
        style={{ width: "36px", fontSize: "11px", padding: "0 3px" }}
        value={values[field.name] ?? ""}
        onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
        onBlur={(e) => commit(field, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.target.blur();
        }}
      />
    );

  // Mounted via portal into canvas.wrapperEl (Fabric's own `.canvas-container`
  // div, already `position: relative`) — token.getBoundingRect(false, true)
  // returns coordinates already accounting for the current pan/zoom, relative to
  // that same element's origin, so no coordinate conversion is needed. The gear
  // sits off the bottom-right corner: top-right holds stacking status icons and
  // top-centre the open-card button.
  const gearLeft = rect.left + rect.width + 2;
  const gearTop = rect.top + rect.height - 18;

  return ReactDOM.createPortal(
    <>
      <button
        ref={gearRef}
        type="button"
        aria-label="Token settings"
        aria-expanded={open}
        title="Token settings"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "absolute",
          left: gearLeft,
          top: gearTop,
          zIndex: 20,
          width: "18px",
          height: "18px",
          padding: 0,
          lineHeight: "16px",
          fontSize: "12px",
          color: "#eee",
          background: "rgba(20,20,20,0.85)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "50%",
          cursor: "pointer",
        }}
      >
        ⚙
      </button>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Token values"
          style={{
            position: "absolute",
            left: gearLeft + 22,
            top: gearTop,
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            padding: "4px 6px",
            background: "rgba(20,20,20,0.9)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "4px",
            pointerEvents: "auto",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {rows.map((row) => (
            <div
              key={row.group ?? row.fields[0].name}
              data-row
              style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#eee" }}
            >
              <span style={{ minWidth: "40px" }}>{row.label}</span>
              {row.fields.map((field, i) => (
                <React.Fragment key={field.name}>
                  {i > 0 && <span style={{ opacity: 0.6 }}>/</span>}
                  {renderInput(field)}
                </React.Fragment>
              ))}
            </div>
          ))}
          {hasIcons && (
            <button
              type="button"
              style={{
                marginTop: "2px",
                fontSize: "11px",
                color: "#eee",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "3px",
                cursor: "pointer",
              }}
              onClick={() => {
                setOpen(false);
                ClientMediator.sendCommand("BattleMap", "ShowIconPicker", { contextId: battleMapId, tokenId: token.id });
              }}
            >
              Icons…
            </button>
          )}
        </div>
      )}
    </>,
    canvas.wrapperEl
  );
};

export default TokenQuickEditOverlay;
