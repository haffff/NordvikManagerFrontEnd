import ClientMediator from "../../../../ClientMediator";

// Which layer is being worked on, and moving elements between layers.
export const layerCommands = {
  meta: {
    SetSelectedLayer: {
      description: 'Sets the active layer. Optionally enables edit-mode for that layer.',
      args: [
        { name: 'layerId', type: 'number', required: true },
        { name: 'withEditMode', type: 'boolean', required: false },
      ],
    },
    SetLayerEditMode: {
      description: 'Enables or disables edit-mode for a layer, fading objects on other layers.',
      args: [
        { name: 'editMode', type: 'boolean', required: true },
        { name: 'layer', type: 'number', required: true },
      ],
    },
    ReassignLayer: {
      description: 'Locally patches canvas objects to new layer ids (used when custom layers are deleted or reordered). Prefer mapping ({oldLayerId: newLayerId}) for multi-layer changes; fromLayerId/toLayerId is sugar for a single-entry mapping.',
      args: [
        { name: 'mapping', type: 'object', required: false },
        { name: 'fromLayerId', type: 'number', required: false },
        { name: 'toLayerId', type: 'number', required: false },
      ],
    },
  },

  methods: {
    SetSelectedLayer({ layerId, withEditMode, isCommand }) {
      if (isCommand && !layerId) {
        return "layerId is required.";
      }

      if (this._canvas.modeLock && !this._canvas.editMode) {
        console.warn("Mode is locked, cannot change layer.");
        return;
      }

      this._canvas.selectedLayer = layerId;
      this._canvas.getObjects().forEach((object) => {
        object.set(
          "selectable",
          object.selectablePermission && object.layer === layerId
        );
      });

      const layerMode = withEditMode ? true : false;

      this.SetLayerEditMode({ editMode: layerMode, layer: layerId });

      ClientMediator.fireEvent("BattleMap_LayerChanged", {
        layer: layerId,
        withEditMode: layerMode,
        battleMapId: this.contextId,
      });
    },

    // Purely a local, cosmetic canvas patch — the DB side of a layer deletion's or
    // reorder's reassignment already happened atomically on the server (see
    // RemoveCustomLayerCommandHandler / MoveCustomLayerCommandHandler), so this
    // never sends a WS command itself.
    //
    // Accepts either a single {fromLayerId, toLayerId} pair (sugar, kept for
    // existing callers) or a batch `mapping: {[oldLayerId]: newLayerId}` — the
    // batch form MUST be used when more than one layer's value changes in the same
    // operation (a Move can shift several layers in one band at once): applying a
    // single-pair reassignment per layer, one at a time, can alias — e.g. layer A
    // going 33->50 and layer B going 50->67 processed in sequence would drag A's
    // just-reassigned elements into B's destination if B is handled second by
    // matching on the literal value 50.
    ReassignLayer({ fromLayerId, toLayerId, mapping, isCommand }) {
      const effectiveMapping = mapping ?? (fromLayerId !== undefined ? { [fromLayerId]: toLayerId } : {});
      if (isCommand && Object.keys(effectiveMapping).length === 0) {
        return "--mapping (or --fromLayerId/--toLayerId) is required.";
      }

      const canvas = this._canvas;
      canvas.getObjects().forEach((object) => {
        if (object.layer in effectiveMapping) object.layer = effectiveMapping[object.layer];
      });

      if (canvas.selectedLayer in effectiveMapping) {
        // The locally active layer was reassigned — fall back to its new value so
        // the next element the user creates doesn't get stamped with a dead layerId.
        this.SetSelectedLayer({ layerId: effectiveMapping[canvas.selectedLayer], withEditMode: false });
      } else {
        this.SortLayers();
      }
    },

    SetLayerEditMode({ editMode, layer, isCommand }) {
      if (isCommand && (editMode === undefined || layer === undefined)) {
        return "--editMode and --layer is required.";
      }

      if (layer === undefined || editMode === undefined) {
        return;
      }

      const canvas = this._canvas;

      if (canvas.editMode === editMode && canvas.editLayer === layer) {
        return;
      }

      canvas.discardActiveObject();

      if (editMode) {
        canvas.editMode = editMode;
        canvas.editLayer = layer;
        canvas.editLock = true;

        canvas.getObjects().forEach((object) => {
          if (object.layer === layer) {
            if (object.currentlyEdited !== undefined) return;
            // Truthiness check (`if (object.origOpacity)`) fails to restore an object
            // whose original opacity was exactly 0 — it stayed dimmed forever. Compare
            // against undefined instead, same fix in both branches below.
            if (object.origOpacity !== undefined) {
              object.set({ opacity: object.origOpacity, origOpacity: undefined });
            }
          } else {
            if (object.origOpacity === undefined) {
              object.set({ origOpacity: object.opacity, opacity: Math.max(0, object.opacity - 0.5) });
            }
            object.set("currentlyEdited", undefined);
          }
        });
      } else {
        canvas.editMode = undefined;   // clear editMode so the early-exit check works next time
        canvas.editLock = false;
        canvas.editLayer = undefined;
        canvas.modeLock = undefined;
        canvas.getObjects().forEach((object) => {
          if (object.origOpacity !== undefined) {
            object.set({ opacity: object.origOpacity, origOpacity: undefined });
          }
          object.set("currentlyEdited", undefined);
        });
      }

      canvas.requestRenderAll();
    },
  },
};
