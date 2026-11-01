import * as React from "react";
import { fabric } from "fabric";
// Loads resource-backed pictures through ActiveWebHelper (the token editor's files).
import "../components/FabricTypesInitializer";
import { createPreviewSession } from "./previewSession";
import { registerPreviewPanels } from "./previewPanels";
import { PART_MIME, pointToAnchorOffset } from "./dragDrop";
// The game's own overlays for a selected token: quick edit (editableProps) and the icon picker.
import { TokenQuickEditOverlay } from "../components/BattleMap/Overlays/TokenQuickEditOverlay";
import { TokenIconPickerOverlay } from "../components/BattleMap/Overlays/TokenIconPickerOverlay";
import { PREVIEW_IDS } from "./previewPanels";

/**
 * The token editor's live preview: the token file drawn by the real TokenManager on its
 * own canvas, reading `values` ({ card, element }: name → string) as the token's card's
 * and its own properties. `onEvent` gets a line for what a click on a part would do.
 *
 * Drag and drop: with `arrange` on, the token's parts can be dragged and each finished
 * drag calls onMovePart(name, { anchor, offsetX, offsetY }); a palette entry (PART_MIME)
 * dropped on it calls onDropPattern(patternId, placement).
 *
 * Selected, the token gets the game's quick-edit and icon-picker overlays; what they
 * write comes back through onProperty(source, name, value).
 */
export function TokenPreview({
  definition, values, gridSize = 50, size = 1, isGM = true, selected = false,
  imageKey = null, width = 320, height = 320, onEvent, onError,
  arrange = false, onMovePart, onDropPattern, onProperty,
}) {
  const area = React.useRef(null);
  const moved = React.useRef(onMovePart);
  moved.current = onMovePart;
  const canvasEl = React.useRef(null);
  const session = React.useRef(null);
  const state = React.useRef({});
  state.current = { values, gridSize, isGM };
  const events = React.useRef(onEvent);
  events.current = onEvent;
  const written = React.useRef(onProperty);
  written.current = onProperty;
  const panels = React.useRef(null);
  const isSelected = React.useRef(selected);
  isSelected.current = selected;
  // The overlays portal into the canvas's wrapper, so they render once it exists.
  const [fabricCanvas, setFabricCanvas] = React.useState(null);

  // The overlays follow the selection: the token while "selected", nothing otherwise.
  const announceSelection = () => panels.current?.select(isSelected.current ? session.current?.token() : null);

  React.useEffect(() => {
    panels.current = registerPreviewPanels({
      get: () => state.current,
      onEvent: (line) => events.current?.(line),
      onProperty: (...change) => written.current?.(...change),
    });
    const canvas = new fabric.Canvas(canvasEl.current, { width, height, selection: false });
    session.current = createPreviewSession({ canvas });
    setFabricCanvas(canvas);
    // onClick parts: dispatched at canvas level on mouse:up, as in the game
    // (OnTokenUIActionClickClientBehavior) — Fabric 5 doesn't reliably fire it on
    // non-selectable objects.
    canvas.on("mouse:up", (opt) => {
      const target = opt.target;
      const action = target?.isTokenUI ? target.tokenData?.actions?.onClick : null;
      // Arranging, a click is the end of a drag, not a press of the part.
      if (action && !session.current.isArranging()) session.current.manager.DispatchTokenUIAction({ parentToken: session.current.token(), element: target, action });
    });
    return () => {
      setFabricCanvas(null);
      session.current.dispose();
      session.current = null;
      canvas.dispose();
      panels.current.dispose();
      panels.current = null;
    };
  }, [width, height]);

  React.useEffect(() => {
    if (!definition) return;
    session.current?.place(definition, { gridSize, size, imageKey })
      .then(() => session.current?.setSelected(selected))
      // A new placement is a new token object: the overlays follow it.
      .then(announceSelection)
      .catch((err) => onError?.(err));
    // selected and values are applied by their own effects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition, gridSize, size, imageKey, width, height]);

  React.useEffect(() => {
    session.current?.refresh().catch((err) => onError?.(err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, isGM]);

  React.useEffect(() => {
    session.current?.setSelected(selected).then(announceSelection).catch((err) => onError?.(err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  React.useEffect(() => {
    session.current?.setArrange(arrange, (name, placement) => moved.current?.(name, placement));
  }, [arrange]);

  const isPart = (e) => Array.from(e.dataTransfer?.types ?? []).includes(PART_MIME);
  const onDragOver = (e) => {
    if (!isPart(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onDrop = (e) => {
    if (!isPart(e)) return;
    e.preventDefault();
    const pattern = e.dataTransfer.getData(PART_MIME);
    const token = session.current?.tokenRect();
    if (!pattern || !token) return;
    const box = area.current.getBoundingClientRect();
    onDropPattern?.(pattern, pointToAnchorOffset({ x: e.clientX - box.left, y: e.clientY - box.top }, token));
  };

  const grid = `${gridSize}px ${gridSize}px`;
  return (
    <div
      ref={area}
      data-testid="token-preview-drop"
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="nm_tokenPreview"
      style={{
        width, height,
        backgroundColor: "var(--nm-preview-bg, #2b2b2b)",
        backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
        backgroundSize: `${grid}, ${grid}`,
        backgroundPosition: `${(width - gridSize * size) / 2}px ${(height - gridSize * size) / 2}px`,
      }}
    >
      <canvas ref={canvasEl} aria-label="Token preview" />
      {fabricCanvas && (
        <>
          <TokenQuickEditOverlay battleMapId={PREVIEW_IDS.map} canvas={fabricCanvas} />
          <TokenIconPickerOverlay battleMapId={PREVIEW_IDS.map} canvas={fabricCanvas} />
        </>
      )}
    </div>
  );
}

export default TokenPreview;
