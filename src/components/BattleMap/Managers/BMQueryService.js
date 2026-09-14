class BMQueryService {
  _canvas = undefined;
  _game = undefined;
  _map = undefined;
  _battleMapModel = undefined;
  _popupRef = undefined;
  _operationModeRef = undefined;
  _destructionSubscriptions = [];
  _selectionChangedSubscriptions = [];

  Load() {
    // Targeted removal (own handler reference only) — NOT a bare
    // this._canvas.off("selection:created") etc. Fabric's off(eventName) with no
    // handler argument clears EVERY listener for that event, not just this class's
    // own, which would wipe out BehaviorDictionaryClient's selection handlers
    // (LoadBMSubscriptions registers those for the same 3 event names) whenever
    // Load() is called a second time — see LoadCanvas.js for why it is.
    if (this._onSelChanged) {
      this._canvas.off("selection:created", this._onSelChanged);
      this._canvas.off("selection:updated", this._onSelChanged);
      this._canvas.off("selection:cleared", this._onSelChanged);
    }

    this._onSelChanged = (e) => this._onSelectionChanged(e);
    this._canvas.on("selection:created", this._onSelChanged);
    this._canvas.on("selection:updated", this._onSelChanged);
    this._canvas.on("selection:cleared", this._onSelChanged);

    this.panel = "battlemap";
    this.contextId = this._battleMapModel.id;
    this.id = "BMQueryService" + this._battleMapModel.id;
  }

  // ── $meta ──────────────────────────────────────────────────────────────────
  // Picked up by CommandExecutionHelper.LoadSuggestions via prototype reflection.
  get $meta() {
    return {
      SubscribeSelectionChanged: {
        description: 'Registers a named callback that fires whenever the canvas selection changes.',
        args: [
          { name: 'name', type: 'string', required: true },
          { name: 'method', type: 'function', required: true },
        ],
      },
      UnSubscribeSelectionChanged: {
        description: 'Removes a previously registered selection-change callback by name.',
        args: [{ name: 'name', type: 'string', required: true }],
      },
      GetSelectedLayer: {
        description: 'Returns the currently active layer ID on the canvas.',
        args: [],
      },
      GetOperationMode: {
        description: 'Returns the current operation mode string from the mode ref.',
        args: [],
      },
      GetSelectedGroupCoords: {
        description: 'Returns the corner coordinates of the active selection / group.',
        args: [],
      },
      GetSelectedObjects: {
        description: 'Returns the array of all currently selected canvas objects.',
        args: [],
      },
      GetSelectedObjectGroup: {
        description: 'Returns the single active object or active selection group.',
        args: [],
      },
      GetName: {
        description: 'Returns the display name of the BattleMap.',
        args: [],
      },
      GetSelectedMapID: {
        description: 'Returns the ID of the map currently loaded in this BattleMap.',
        args: [],
      },
      GetSelectedMap: {
        description: 'Returns the full map object currently loaded in this BattleMap.',
        args: [],
      },
      GetDragMode: {
        description: 'Returns true when canvas pan/drag mode is active, otherwise null.',
        args: [],
      },
      GetCreateElement: {
        description: 'Returns the element template used in simple-create mode.',
        args: [],
      },
      GetModeType: {
        description: 'Returns the sub-type string of the current canvas mode (e.g. "Ruler").',
        args: [],
      },
      GetBrush: {
        description: 'Returns the active freehand drawing brush, or undefined when not drawing.',
        args: [],
      },
      GetAlign: {
        description: 'Returns the current snap-align mode string (e.g. "grid", "object").',
        args: [],
      },
      GetMeasureOptions: {
        description: 'Returns the full measure-mode options object (units, distancePerSquare, etc.).',
        args: [],
      },
      GetCurrentMode: {
        description: 'Returns the name of the active exclusive mode ("TokenSelect", "SimpleCreate", "Draw", "Ruler"), or "None" when no exclusive mode is locked.',
        args: [],
      },
      SubscribeBattleMapDestruction: {
        description: 'Registers a callback that fires when this BattleMap component is destroyed.',
        args: [{ name: 'method', type: 'function', required: true }],
      },
    };
  }

  SubscribeSelectionChanged({ name, method, isCommand }) {
    this._selectionChangedSubscriptions.push({ name, method });
  }

  UnSubscribeSelectionChanged({ name }) {
    this._selectionChangedSubscriptions =
      this._selectionChangedSubscriptions.filter((x) => x.name !== name);
  }

  _onSelectionChanged(event) {
    this._selectionChangedSubscriptions.forEach((element) => {
      element.method(event);
    });
  }

  GetSelectedLayer() {
    return this._canvas.selectedLayer;
  }

  GetOperationMode() {
    return this._operationModeRef.current;
  }

  GetSelectedGroupCoords() {
    let obj = this._canvas.getActiveObject();
    return obj.getCoords();
  }

  GetSelectedObjects() {
    return this._canvas.getActiveObjects();
  }

  GetSelectedObjectGroup() {
    return this._canvas.getActiveObject();
  }

  GetName() {
    return this._battleMapModel.name;
  }

  GetSelectedMapID() {
    if (this._map === undefined) return undefined;
    return this._map.id;
  }

  GetSelectedMap() {
    return this._map;
  }

  GetDragMode() {
    return this._canvas.draggingMode ?? null;
  }

  GetCreateElement() {
    return this._canvas.simpleCreateElement;
  }

  GetModeType() {
    return this._canvas.modeType;
  }

  GetBrush() {
    if (this._canvas.isDrawingMode) {
      return this._canvas.freeDrawingBrush;
    }
  }

  GetAlign()
  {
    return this._canvas.alignMode;
  }

  GetMeasureOptions() {
    return this._canvas.measure;
  }

  GetCurrentMode() {
    const canvas = this._canvas;
    if (canvas.modeLock) {
      if (canvas.tokenSelectMode) {
        return "TokenSelect";
      }
      if (canvas.simpleCreateElement) {
        return "SimpleCreate";
      }
      if (canvas.isDrawingMode) {
        return "Draw";
      }
      if (canvas.rulerMode) {
        return "Ruler";
      }
    }

    // A representable value rather than bare undefined, so callers that render
    // the result (Run dialog, chat /c) show an answer instead of nothing.
    return "None";
  }

  _onDestruction = () => {
    this._destructionSubscriptions.forEach((e) => e());
  };

  SubscribeBattleMapDestruction(method) {
    this._destructionSubscriptions.push(method);
  }
}
export default BMQueryService;
