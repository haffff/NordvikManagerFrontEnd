import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '../../../../setupTests';

vi.mock('@hlorenzi/react-dockable', () => ({
  useContentContext: () => ({ setTitle: vi.fn(), setPreferredSize: vi.fn() }),
}));
vi.mock('../../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));
vi.mock('../../../uiComponents/hooks/useBattleMapName', () => ({ default: () => 'Map' }));
vi.mock('../../../uiComponents/hooks/useDimensions', () => ({ useDimensions: () => ({ width: 300, height: 800 }) }));
vi.mock('../../../uiComponents/hooks/useCustomLayers', () => ({ useCustomLayers: () => ({ layers: [] }) }));
const noTools = [];
vi.mock('../../../BattleMap/mapToolsStore', () => ({ getMapTools: () => noTools, subscribeMapTools: () => () => {} }));

let canEdit = false;
vi.mock('../../../../contexts/PermissionsContext', () => ({
  usePermissions: () => ({ hasEntityPermission: () => canEdit }),
}));

const sendCommand = vi.fn();
vi.mock('../../../../ClientMediator', () => ({
  default: {
    sendCommand: (...args) => sendCommand(...args),
    sendCommandAsync: vi.fn(),
    sendCommandWaitForRegisterAsync: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn(),
  },
}));

import { ToolsPanel } from './ToolsPanel';
import { AddCircleOptions } from './AddCircleOptions';
import { AddTextOptions } from './AddTextOptions';

beforeEach(() => {
  sendCommand.mockReset();
  sendCommand.mockImplementation((panel, command) => {
    if (command === 'GetSelectedMap') return { id: 'map-1' };
    if (command === 'GetCreateElement') return { fill: 'red', stroke: 'black', radius: 100, fontSize: 40 };
    return undefined;
  });
});

describe('ToolsPanel — Sketch', () => {
  it('a player who cannot edit the map gets Sketch, but not the drawing or shape tools', () => {
    canEdit = false;
    renderWithProviders(<ToolsPanel battleMapId="bm-1" />);

    expect(screen.getByText('Sketch')).toBeInTheDocument();
    expect(screen.queryByText('Paint')).toBeNull();
    expect(screen.queryByText('Circle')).toBeNull();
  });

  it('Sketch turns on free drawing in sketch mode', async () => {
    canEdit = true;
    renderWithProviders(<ToolsPanel battleMapId="bm-1" />);

    await userEvent.click(screen.getByText('Sketch'));

    expect(sendCommand).toHaveBeenCalledWith('BattleMap', 'SetFreeDrawMode',
      expect.objectContaining({ contextId: 'bm-1', enabled: true, sketch: true }));
  });
});

describe('Circle / Text options — sized by dragging, no static size field', () => {
  it('the circle options have no Radius field', () => {
    renderWithProviders(<AddCircleOptions battleMapId="bm-1" />);
    expect(screen.queryByText('Radius')).toBeNull();
    expect(screen.queryByDisplayValue('100')).toBeNull();
  });

  it('the text options have no font size field', () => {
    renderWithProviders(<AddTextOptions battleMapId="bm-1" />);
    expect(screen.queryByDisplayValue('40')).toBeNull();
  });
});
