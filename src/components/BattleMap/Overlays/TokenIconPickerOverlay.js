import * as React from "react";
import * as ReactDOM from "react-dom";
import ClientMediator from "../../../ClientMediator";
import UtilityHelper from "../../../helpers/UtilityHelper";
import { ICON_PACK_LOADERS } from "../../../helpers/ReactIconPackLoaders";
import { resolveTokenParentId, writeTokenProperty } from "./tokenPropertyIO";

/**
 * New: lets a user assign/remove SVG status icons on a token (e.g. "poisoned"),
 * for whichever icons its own token template declares via a token-root
 * `assignableIcons` array — addon-declared, this widget has no hardcoded
 * knowledge of what any of them mean:
 *   "assignableIcons": [{ "id": "poisoned", "label": "Poisoned", "iconPack": "gi",
 *                          "iconName": "GiPoisonBottle", "dtoProperty": "status_poisoned",
 *                          "source": "card" }]
 * Each entry needs a matching `additions[]` icon (own visible propDep on the
 * same dtoProperty, anchor "right-top") to actually render on the token —
 * this picker only toggles the boolean property that dep reads.
 *
 * Deliberately a separate, explicitly-triggered popup (ShowIconPicker/HideIconPicker
 * via ClientMediator, mirroring PopupBMOverlay's own registration pattern) rather
 * than always-shown-on-selection like TokenQuickEditOverlay — assigning icons is
 * an occasional action taken from the token's right-click menu, not something
 * that should float next to every selected token that happens to declare icons.
 */
export const TokenIconPickerOverlay = ({ battleMapId, canvas }) => {
  const [token, setToken] = React.useState(null);
  const [rect, setRect] = React.useState(null);
  const [assigned, setAssigned] = React.useState({}); // icon.id -> boolean
  const [propertyIds, setPropertyIds] = React.useState({}); // icon.id -> property id
  const [iconComponents, setIconComponents] = React.useState({}); // "pack:name" -> Component

  const assignableIcons = token?.tokenData?.assignableIcons ?? [];

  // ── Show/Hide via ClientMediator ──────────────────────────────────────────
  React.useEffect(() => {
    if (!battleMapId) return;
    const regId = "BattleMap_IconPicker_" + battleMapId;
    ClientMediator.unregister(regId); // ensure clean state, mirrors PopupBMOverlay
    ClientMediator.register({
      panel: "BattleMap",
      id: regId,
      contextId: battleMapId,
      ShowIconPicker: ({ tokenId }) => {
        const found = canvas?.getObjects().find((o) => o.id === tokenId);
        setToken(found?.tokenData?.assignableIcons?.length ? found : null);
      },
      HideIconPicker: () => setToken(null),
    });
    return () => ClientMediator.unregister(regId);
  }, [battleMapId, canvas]);

  // Hide if selection changes away from the token this picker is open for —
  // otherwise it'd float over an unrelated selection.
  React.useEffect(() => {
    if (!battleMapId) return;
    const name = "TokenIconPickerOverlay_" + battleMapId;
    const onSelectionChanged = (event) => {
      const single = event.selected?.length === 1 ? event.selected[0] : null;
      setToken((current) => (current && single !== current ? null : current));
    };
    ClientMediator.sendCommandWaitForRegister("BattleMap", "SubscribeSelectionChanged", {
      contextId: battleMapId,
      name,
      method: onSelectionChanged,
    }, true);
    return () => {
      // Best-effort cleanup — see TokenQuickEditOverlay.js's identical guard for why.
      try {
        ClientMediator.sendCommand("BattleMap", "UnSubscribeSelectionChanged", {
          contextId: battleMapId,
          name,
        });
      } catch (e) {
        console.warn("TokenIconPickerOverlay: UnSubscribeSelectionChanged cleanup failed", e);
      }
    };
  }, [battleMapId]);

  // ── Fetch current assigned state whenever the picker opens for a token ───
  React.useEffect(() => {
    if (!token || !assignableIcons.length) {
      setAssigned({});
      setPropertyIds({});
      return;
    }
    let cancelled = false;
    (async () => {
      const grouped = assignableIcons.reduce((acc, icon) => {
        (acc[icon.source] ??= []).push(icon);
        return acc;
      }, {});
      const nextAssigned = {};
      const nextIds = {};
      await Promise.all(
        Object.entries(grouped).map(async ([source, icons]) => {
          const parentId = resolveTokenParentId(source, token);
          if (!parentId) return;
          const names = icons.map((i) => i.dtoProperty);
          const fetched = await ClientMediator
            .sendCommandAsync("Properties", "GetByNames", { parentId, names })
            .catch(() => []);
          icons.forEach((icon) => {
            const found = fetched?.find((f) => f.name === icon.dtoProperty);
            // Same .NET bool.ToString() ("True"/"False") round-trip as every
            // other boolean property in this addon — ParseBool normalizes it.
            nextAssigned[icon.id] = UtilityHelper.ParseBool(found?.value ?? false);
            if (found?.id) nextIds[icon.id] = found.id;
          });
        })
      );
      if (!cancelled) {
        setAssigned(nextAssigned);
        setPropertyIds(nextIds);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Load the react-icons components needed for preview ───────────────────
  React.useEffect(() => {
    if (!assignableIcons.length) return;
    let cancelled = false;
    (async () => {
      const next = {};
      await Promise.all(
        assignableIcons.map(async ({ iconPack, iconName }) => {
          const key = `${iconPack}:${iconName}`;
          const loader = ICON_PACK_LOADERS[iconPack];
          if (!loader) {
            console.warn(`TokenIconPickerOverlay: unknown react-icons pack "${iconPack}"`);
            return;
          }
          try {
            const pack = await loader();
            if (pack[iconName]) next[key] = pack[iconName];
            else console.warn(`TokenIconPickerOverlay: icon "${iconName}" not found in react-icons/${iconPack}`);
          } catch {
            console.warn(`TokenIconPickerOverlay: could not load react-icons pack "${iconPack}"`);
          }
        })
      );
      if (!cancelled) setIconComponents((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Screen position tracking — same technique as TokenQuickEditOverlay ───
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

  const toggleIcon = (icon) => {
    const next = !assigned[icon.id];
    setAssigned((prev) => ({ ...prev, [icon.id]: next }));
    writeTokenProperty({
      token,
      source: icon.source,
      dtoProperty: icon.dtoProperty,
      value: next,
      existingId: propertyIds[icon.id],
    });
  };

  if (!token || !rect || !canvas?.wrapperEl) return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: "absolute",
        left: rect.left,
        top: rect.top + rect.height + 6,
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        maxWidth: "190px",
        padding: "8px",
        background: "rgba(20,20,20,0.9)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: "4px",
        pointerEvents: "auto",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => setToken(null)}
          title="Close"
          style={{
            width: "18px",
            height: "18px",
            padding: 0,
            lineHeight: "16px",
            fontSize: "11px",
            cursor: "pointer",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: "3px",
            background: "rgba(255,255,255,0.05)",
            color: "#eee",
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {assignableIcons.map((icon) => {
        const IconComponent = iconComponents[`${icon.iconPack}:${icon.iconName}`];
        const isAssigned = assigned[icon.id] === true;
        return (
          <button
            key={icon.id}
            title={icon.label ?? icon.id}
            onClick={() => toggleIcon(icon)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              padding: 0,
              cursor: "pointer",
              borderRadius: "4px",
              border: isAssigned ? "2px solid rgb(120,180,255)" : "1px solid rgba(255,255,255,0.25)",
              background: isAssigned ? "rgba(60,100,160,0.5)" : "rgba(255,255,255,0.05)",
              color: "#eee",
            }}
          >
            {IconComponent ? <IconComponent size={18} /> : "?"}
          </button>
        );
      })}
      </div>
    </div>,
    canvas.wrapperEl
  );
};

export default TokenIconPickerOverlay;
