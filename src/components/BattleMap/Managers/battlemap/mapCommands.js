import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../helpers/transport";
import CommandFactory from "../../Factories/CommandFactory";
import ClientMediator from "../../../../ClientMediator";

// The map itself: switching and reloading it, the view, the grid, snapping and dragging.
export const mapCommands = {
  meta: {
    FocusElement: {
      description: 'Centres the view on an element (e.g. a token) and selects it if this player may.',
      args: [{ name: 'elementId', type: 'string', required: true }],
    },
    ReloadBattleMapComponent: {
      description: 'Fully reloads the BattleMap component (e.g. after a map change).',
      args: [],
    },
    ChangeMap: {
      description: 'Requests a map switch via the server (persists + broadcasts to all clients). Required: id (map id)',
      args: [{ name: 'id', type: 'mapid', required: true }],
    },
    ApplyMapChange: {
      description: 'Applies a server-confirmed map change locally (reloads canvas). Called by OnMapChange handler — do not call directly from UI.',
      args: [{ name: 'id', type: 'mapid', required: true }],
    },
    UpdateMapReference: {
      description: 'Merges new settings into the live map reference held by BMQueryService.',
      args: [{ name: 'mapData', type: 'object', required: true }],
    },
    SortLayers: {
      description: 'Re-sorts all canvas objects by their layer value.',
      args: [],
    },
    EditGrid: {
      description: 'Selects the grid object so it can be edited.',
      args: [],
    },
    SetAlign: {
      description: 'Sets the snap-align mode (e.g. "grid", "object", or undefined to disable).',
      args: [{ name: 'align', type: 'string', required: true }],
    },
    SetDragMode: {
      description: 'Enables or disables canvas pan/drag mode.',
      args: [{ name: 'enabled', type: 'boolean', required: true }],
    },
  },

  methods: {
    ///Reload whole battlemap(for example. map change)
    ReloadBattleMapComponent() {
      this._reloadCommand();
    },

    ChangeMap(idOrObj) {
      const id = idOrObj?.id ?? idOrObj?.mapId ?? idOrObj;
      if (!id) return `ChangeMap: no map id provided`;
      const battleMapId = this._battleMapModel?.id;
      if (!battleMapId) return `ChangeMap: battlemap not loaded yet`;
      WebSocketManagerInstance.Send(CommandFactory.CreateChangeMapCommand(id, battleMapId));
    },

    ApplyMapChange(idOrObj) {
      const id = idOrObj?.id ?? idOrObj?.mapId ?? idOrObj;
      if (!id) return `ApplyMapChange: no map id provided`;
      if (typeof this._changeMapCommand !== 'function') return `ApplyMapChange: not ready (canvas not loaded yet)`;
      return this._changeMapCommand(id);
    },

    UpdateMapReference({ mapData }) {
      // Update the map reference in BMQueryService with new settings
      if (this._BMQueryService && this._BMQueryService._map) {
        Object.assign(this._BMQueryService._map, mapData);
      }
    },

    // Centres the view on an element, keeping the zoom; selects it only if this player
    // may (a token they can't control stays unselected).
    FocusElement({ elementId } = {}) {
      const canvas = this._canvas;
      const element = canvas?.getObjects().find((o) => o.id === elementId);
      if (!element) return `Element ${elementId} is not on this map`;

      const centre = element.getCenterPoint();
      const zoom = canvas.getZoom();
      const vpt = [...canvas.viewportTransform];
      vpt[4] = canvas.getWidth() / 2 - centre.x * zoom;
      vpt[5] = canvas.getHeight() / 2 - centre.y * zoom;
      canvas.setViewportTransform(vpt);
      if (element.selectable) canvas.setActiveObject(element);
      canvas.requestRenderAll();
    },

    SortLayers() {
      this._canvas.sortLayers();
    },

    EditGrid({ isCommand}) {
      this._canvas.discardActiveObject();
      //this._canvas.editGridMode = true;
      //get .grid object
      let grid = this._canvas.getObjects().find((x) => x.name === ".grid");
      //set active object
      this._canvas.setActiveObject(grid);

      this._canvas.requestRenderAll();
    },

    SetAlign({ align, isCommand }) {
      if (isCommand && !align) {
        return "align is required.";
      }

      ClientMediator.fireEvent("BattleMap_AlignChanged", { align, battleMapId: this.contextId });
      this._canvas.alignMode = align;
    },

    SetDragMode({ enabled, isCommand }) {
      if (isCommand && enabled === undefined) {
        return "enabled is required.";
      }

      if(this._canvas.dragModeLock)
      {
        return;
      }

      ClientMediator.fireEvent("BattleMap_DragModeChanged", { enabled, battleMapId: this.contextId });
      this._canvas.draggingMode = enabled ? true : undefined;
    },
  },
};
