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
    this._canvas.off("selection:created");
    this._canvas.off("selection:updated");
    this._canvas.off("selection:cleared");

    let onSelChanged = this._onSelectionChanged.bind(this);
    this._canvas.on("selection:created", (e) => onSelChanged(e));
    this._canvas.on("selection:updated", (e) => onSelChanged(e));
    this._canvas.on("selection:cleared", (e) => onSelChanged(e));

    this.panel = "battlemap";
    this.contextId = this._battleMapModel.id;
    this.id = "BMQueryService" + this._battleMapModel.id;
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

    return undefined;
  }

  _onDestruction = () => {
    this._destructionSubscriptions.forEach((e) => e());
  };

  SubscribeBattleMapDestruction(method) {
    this._destructionSubscriptions.push(method);
  }
}
export default BMQueryService;
