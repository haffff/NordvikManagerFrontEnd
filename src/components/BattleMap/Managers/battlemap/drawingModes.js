import { fabric } from "fabric";
import ClientMediator from "../../../../ClientMediator";
import { cleanSketches, undoSketch } from "../../Behaviors/Client/Draw/sketches";

// Modes that add to the map: free drawing, sketches, and drag-to-create.
export const drawingModes = {
  meta: {
    SetFreeDrawMode: {
      description: 'Enables or disables freehand pencil-draw mode. With sketch: true the strokes are sketches — previews shown to the others (unless visibleToOthers is false) and never saved — so it needs no Edit on the map.',
      args: [
        { name: 'enabled', type: 'boolean', required: true },
        { name: 'sketch', type: 'boolean', required: false },
        { name: 'visibleToOthers', type: 'boolean', required: false },
      ],
    },
    SetSimpleCreateMode: {
      description: 'Enables or disables simple-click-to-place creation mode for a canvas element. withSizing sizes it by dragging: "box" (corner to corner; true means the same), "radius" (circle, from its center) or "fontSize" (text, the dragged height); without it the element is placed at its own size.',
      args: [
        { name: 'enabled', type: 'boolean', required: true },
        { name: 'type', type: 'string', required: false },
        { name: 'withSizing', type: 'string|boolean', required: false },
      ],
    },
    UndoSketch: {
      description: "Removes the current player's last sketch, for everyone.",
      args: [],
    },
    CleanSketches: {
      description: "Removes the current player's sketches for everyone; with everyone: true (GM) every sketch and measurement preview on the map.",
      args: [{ name: 'everyone', type: 'boolean', required: false }],
    },
  },

  methods: {
    SetCreateElement({ element }) {
      if (this._canvas.simpleCreateMode) {
        this._canvas.simpleCreateElement = element;
      }
    },

    SetFreeDrawMode({ enabled, overlayContent, popupContent, isCommand, brush, sketch, visibleToOthers }) {
      if (isCommand && enabled === undefined) {
        return "enabled is required.";
      }

      const canvas = this._canvas;

      if (enabled) {
        if (canvas.modeLock) {
          console.warn("Mode is locked, cannot change free draw mode.");
          return;
        }

        canvas.modeLock = true;
        canvas.discardActiveObject();
        canvas.freeDrawMode = true;
        canvas.freeDrawSketch = sketch ? { visibleToOthers: visibleToOthers !== false } : undefined;
        canvas.selection = false;

        this.SetDragMode({ enabled: false });
        canvas.dragModeLock = true;

        canvas.isDrawingMode = true;
        if (brush) {
          canvas.freeDrawingBrush = brush;
          canvas.freeDrawingBrush.initialize(canvas);
        } else {
          canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
          canvas.freeDrawingBrush.width = 5;
          canvas.freeDrawingBrush.color = "rgba(0,0,0,1)";
          canvas.freeDrawingBrush.fill = "rgba(0,0,0,1)";
          canvas.freeDrawingBrush.initialize(canvas);
        }

        canvas.on("path:created", this._path_created);

        this._addPopupAndOverlay(overlayContent, popupContent);

        canvas.getObjects().forEach((object) => {
          object.set("beforeFreeDrawSelectable", object.selectable);
          object.set("selectable", false);
        });

        ClientMediator.fireEvent("BattleMap_ModeChanged", {
          battleMapId: this.contextId,
          mode: "Draw",
          type: sketch ? "Sketch" : undefined,
        });
      } else {
        if (canvas.freeDrawMode) {
          canvas.modeLock = undefined;
          canvas.freeDrawMode = undefined;
          // The sketches themselves stay on the map; only drawing new ones stops.
          canvas.freeDrawSketch = undefined;
          canvas.selection = true;

          canvas.isDrawingMode = false;
          canvas.freeDrawingBrush = undefined;
          canvas.dragModeLock = false;

          canvas.off("path:created", this._path_created);
          this._removePopupAndOverlay();

          canvas.getObjects().forEach((object) => {
            if (object.beforeFreeDrawSelectable !== undefined) {
              object.set("selectable", object.beforeFreeDrawSelectable);
              object.set("beforeFreeDrawSelectable", undefined);
            }
          });

          ClientMediator.fireEvent("BattleMap_ModeChanged", {
            battleMapId: this.contextId,
            mode: undefined,
            type: undefined,
          });
        }
      }
    },

    SetSimpleCreateMode({
      enabled,
      element,
      overlayContent,
      popupContent,
      type,
      withSizing,
    }) {
      const canvas = this._canvas;
      if (enabled) {
        if (canvas.modeLock) {
          console.warn("Mode is locked, cannot change simple create mode.");
          return;
        }

        canvas.modeLock = true;
        canvas.discardActiveObject();
        canvas.simpleCreateMode = true;
        canvas.simpleCreateElement = element;
        canvas.withSizing = withSizing;
        canvas.selection = false;
        canvas.modeType = type;

        this.SetDragMode({ enabled: false });
        canvas.dragModeLock = true;
        canvas.defaultCursor = 'crosshair';
        canvas.hoverCursor = 'crosshair';

        this._addPopupAndOverlay(overlayContent, popupContent);

        //ensure that object is in proper layer and has map id
        element.layer = canvas.selectedLayer;
        element.mapId = this._BMQueryService.GetSelectedMapID();

        canvas.getObjects().forEach((object) => {
          //save selectable state in other prop
          object.set("beforeSimpleCreateSelectable", object.selectable);
          object.set("selectable", false);
        });

        ClientMediator.fireEvent("BattleMap_ModeChanged", {
          battleMapId: this.contextId,
          mode: "SimpleCreate",
          type: canvas.modeType,
        });
      } else {
        if (canvas.simpleCreateMode) {
          canvas.modeLock = undefined;
          canvas.simpleCreateMode = undefined;
          canvas.simpleCreateElement = undefined;
          canvas.withSizing = undefined;
          canvas.selection = true;
          canvas.modeType = undefined;
          canvas.dragModeLock = false;
          canvas.defaultCursor = 'default';
          canvas.hoverCursor = 'move';

          this._removePopupAndOverlay();

          canvas.getObjects().forEach((object) => {
            if (object.beforeSimpleCreateSelectable !== undefined) {
              object.set("selectable", object.beforeSimpleCreateSelectable);
              object.set("beforeSimpleCreateSelectable", undefined);
            }
          });

          ClientMediator.fireEvent("BattleMap_ModeChanged", {
            battleMapId: this.contextId,
            mode: undefined,
            type: undefined,
          });
        }
      }
    },

    UndoSketch() {
      undoSketch(this._canvas, this.contextId);
    },

    CleanSketches({ everyone } = {}) {
      cleanSketches(this._canvas, this.contextId, { everyone: !!everyone });
    },
  },
};
