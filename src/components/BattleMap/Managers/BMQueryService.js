class BMQueryService {
    _canvas = undefined;
    _game = undefined;
    _map = undefined;
    _getSelectedLayer = undefined;
    _battleMapModel = undefined;
    _popupRef = undefined;
    _operationModeRef = undefined;
    _destructionSubscriptions = [];
    _selectionChangedSubscriptions = [];

    Load()
    {
      this._canvas.off("selection:created");
      this._canvas.off("selection:updated");
      this._canvas.off("selection:cleared");
      
      let onSelChanged = this._onSelectionChanged.bind(this);
      this._canvas.on("selection:created",(e) => onSelChanged(e));
      this._canvas.on("selection:updated",(e) => onSelChanged(e));
      this._canvas.on("selection:cleared",(e) => onSelChanged(e));

      this.panel = "battlemap";
      this.contextId = this._battleMapModel.id;
      this.id = "BMQueryService" + this._battleMapModel.id;
    }


    SubscribeSelectionChanged({name, method})
    {
        this._selectionChangedSubscriptions.push({name, method})
    }

    UnSubscribeSelectionChanged({name})
    {
        this._selectionChangedSubscriptions = this._selectionChangedSubscriptions.filter(x=>x.name !== name);
    }


    _onSelectionChanged(event)
    {
        this._selectionChangedSubscriptions.forEach(element => {
            element.method(event);
        });
    }

    GetSelectedLayer()
    {
        return this._getSelectedLayer().current;
    }

    GetOperationMode()
    {
        return this._operationModeRef.current;
    }

    GetPopupRef()
    {
        return this._popupRef;
    }

    GetSelectedGroupCoords()
    {
        let obj = this._canvas.getActiveObject();
        return obj.getCoords();
    }

    GetSelectedObjects()
    {
        return this._canvas.getActiveObjects();
    }

    GetSelectedObjectGroup()
    {
        return this._canvas.getActiveObject();
    }

    GetName()
    {
        return this._battleMapModel.name;
    }

    GetSelectedMapID()
    {
        if(this._map === undefined)
            return undefined;
        return this._map.id;
    }

    GetSelectedMap()
    {
        return this._map;
    }

    _onDestruction = () => {
        this._destructionSubscriptions.forEach( (e) => e() );
    }

    SubscribeBattleMapDestruction(method)
    {
        this._destructionSubscriptions.push(method)
    }
}
export default BMQueryService;
