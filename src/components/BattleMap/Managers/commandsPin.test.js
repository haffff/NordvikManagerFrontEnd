import { vi, describe, it, expect } from 'vitest';

vi.mock('../../../helpers/transport', () => ({
  ActiveTransportManager: { Subscribe: vi.fn(), Unsubscribe: vi.fn(), Send: vi.fn() },
  ActiveWebHelper: { getAsync: vi.fn(), postAsync: vi.fn(), getResourceString: vi.fn() },
}));

import BMQueryService from './BMQueryService';
import BMService from './BMService';
import TokenManager from './TokenManager';

// The command names are what keyboard bindings, the Run dialog and addons call, so moving
// code between files must not change them. Read the way the Run dialog reads them
// (CommandExecutionHelper.LoadSuggestions).
const commandsOf = (Service) => {
  const proto = Service.prototype;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => !name.startsWith('_') && !['constructor', '$meta', 'Load'].includes(name))
    .filter((name) => typeof proto[name] === 'function')
    .sort();
};

const canvas = { on: vi.fn(), off: vi.fn() };
const built = (Service) => {
  const service = new Service({ canvas, getCanvas: () => canvas, battleMapModel: { id: 'bm-1' } });
  if (!service.panel) {
    service._canvas = canvas;
    service._battleMapModel = { id: 'bm-1' };
    service.Load(() => canvas);
  }
  return service;
};

const expected = {
  BMQueryService: {
    Service: BMQueryService,
    panel: 'battlemap',
    id: 'BMQueryServicebm-1',
    commands: ['GetAlign', 'GetBrush', 'GetCreateElement', 'GetCurrentMode', 'GetDragMode', 'GetLastClickPos', 'GetMeasureOptions', 'GetModeType', 'GetName', 'GetOperationMode', 'GetSelectedGroupCoords', 'GetSelectedLayer', 'GetSelectedMap', 'GetSelectedMapID', 'GetSelectedObjectGroup', 'GetSelectedObjects', 'GetSketchOptions', 'SubscribeBattleMapDestruction', 'SubscribeSelectionChanged', 'UnSubscribeSelectionChanged'],
    meta: ['GetAlign', 'GetBrush', 'GetCreateElement', 'GetCurrentMode', 'GetDragMode', 'GetLastClickPos', 'GetMeasureOptions', 'GetModeType', 'GetName', 'GetOperationMode', 'GetSelectedGroupCoords', 'GetSelectedLayer', 'GetSelectedMap', 'GetSelectedMapID', 'GetSelectedObjectGroup', 'GetSelectedObjects', 'GetSketchOptions', 'SubscribeBattleMapDestruction', 'SubscribeSelectionChanged', 'UnSubscribeSelectionChanged'],
  },
  BMService: {
    Service: BMService,
    panel: 'battlemap',
    id: 'BMServicebm-1',
    commands: ['ApplyMapChange', 'CancelPickPoint', 'CancelPickTargets', 'ChangeMap', 'CleanPreviews', 'CleanSketches', 'CopyElements', 'DisableAllModes', 'EditGrid', 'FinishPickTargets', 'FocusElement', 'GroupSelected', 'PasteElements', 'PickPointClick', 'PickPointMove', 'PickTargetsClick', 'ReassignLayer', 'ReloadBattleMapComponent', 'RemoveSelected', 'SetActionToolMode', 'SetAlign', 'SetCreateElement', 'SetDragMode', 'SetFreeDrawMode', 'SetLayerEditMode', 'SetMeasureMode', 'SetMeasureObjects', 'SetPickPointMode', 'SetPickTargetsMode', 'SetSelectedLayer', 'SetSimpleCreateMode', 'SetTokenSelectMode', 'SortLayers', 'UndoSketch', 'UngroupSelected', 'UnsetTokenSelectMode', 'UpdateMapReference'],
    meta: ['ApplyMapChange', 'CancelPickPoint', 'CancelPickTargets', 'ChangeMap', 'CleanPreviews', 'CleanSketches', 'CopyElements', 'DisableAllModes', 'EditGrid', 'FinishPickTargets', 'FocusElement', 'GroupSelected', 'PasteElements', 'PickPointClick', 'PickPointMove', 'PickTargetsClick', 'ReassignLayer', 'ReloadBattleMapComponent', 'RemoveSelected', 'SetActionToolMode', 'SetAlign', 'SetDragMode', 'SetFreeDrawMode', 'SetLayerEditMode', 'SetMeasureMode', 'SetPickPointMode', 'SetPickTargetsMode', 'SetSelectedLayer', 'SetSimpleCreateMode', 'SetTokenSelectMode', 'SortLayers', 'UndoSketch', 'UngroupSelected', 'UnsetTokenSelectMode', 'UpdateMapReference'],
  },
  TokenManager: {
    Service: TokenManager,
    panel: 'battlemap_token',
    id: 'TokenManagerbm-1',
    commands: ['CanvasObjectLoadToken', 'CreateToken', 'DispatchTokenUIAction', 'GetAvailableMaskGroups', 'GetTokenCardID', 'IsToken', 'UpdateTokenBasedOnProperties', 'UpdateTokenPropertySpecific', 'UpdateTokenUIPositions', 'UpdateTokensPropertySpecific'],
    meta: ['CanvasObjectLoadToken', 'CreateToken', 'GetAvailableMaskGroups', 'GetTokenCardID', 'IsToken', 'UpdateTokenBasedOnProperties', 'UpdateTokenPropertySpecific', 'UpdateTokenUIPositions', 'UpdateTokensPropertySpecific'],
  },
};

describe.each(Object.entries(expected))('%s', (_, { Service, panel, id, commands, meta }) => {
  it('keeps its commands', () => {
    expect(commandsOf(Service)).toEqual(commands);
  });

  it('keeps its command descriptions', () => {
    expect(Object.keys(built(Service).$meta).sort()).toEqual(meta);
  });

  it('keeps its mediator identity', () => {
    const service = built(Service);

    expect(service.panel).toBe(panel);
    expect(service.id).toBe(id);
    expect(service.contextId).toBe('bm-1');
  });
});
