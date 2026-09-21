import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import { renderWithProviders } from '../../../../setupTests';

const subHandlers = {};
vi.mock('../../../uiComponents/base/Subscribable', () => ({
  default: ({ commandPrefix, onMessage }) => { subHandlers[commandPrefix] = onMessage; return null; },
}));
vi.mock('../../../uiComponents/base/CollectionSyncer', () => ({ default: () => null }));
vi.mock('../../../uiComponents/base/Modals/InputModal', () => ({ default: () => null }));
vi.mock('../../panels/LayoutsManagerPanel', () => ({ default: () => null }));
vi.mock('../../../../helpers/LayoutCloneHelper', () => ({ default: { GetCloneForSaving: vi.fn() } }));
vi.mock('../../../../helpers/LayoutPersistence', () => ({ default: { clear: vi.fn() } }));
vi.mock('../../../../ClientMediator', () => ({ default: { sendCommand: vi.fn() } }));
vi.mock('../../../BattleMap/Factories/CommandFactory', () => ({
  default: {
    CreateLayoutRemoveCommand: (id) => ({ command: 'layout_remove', data: id }),
    CreateLayoutAddCommand: (data) => ({ command: 'layout_add', data }),
  },
}));
vi.mock('../../../../helpers/transport', () => ({
  ActiveWebHelper: { get: vi.fn() },
  ActiveTransportManager: { Send: vi.fn() },
}));

// Flatten the dropdown menu chrome so its items render as plain, always-visible
// buttons — avoids pulling in PermissionsContext/Chakra Menu machinery.
vi.mock('../../../uiComponents/base/DDItems/DropDownMenu', () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock('../../../uiComponents/base/DDItems/DropDownItem', () => ({
  default: ({ name, onClick }) => <button onClick={onClick}>{name}</button>,
}));
vi.mock('../../../uiComponents/base/DDItems/DropDownSeparator', () => ({ default: () => null }));
vi.mock('../../../uiComponents/base/DDItems/SpecialButtons/CreateDropDownButton', () => ({
  default: ({ name }) => <button>{name}</button>,
}));
vi.mock('../../../uiComponents/base/DDItems/SpecialButtons/DeletableDropDownButton', () => ({
  default: ({ name, onClick }) => <button onClick={onClick}>{name}</button>,
}));

import { ActiveWebHelper as WebHelper } from '../../../../helpers/transport';
import { LayoutsMenu } from './LayoutsMenu';

const fakeState = { ref: { current: { rootPanel: {} } } };

const render = () => renderWithProviders(<LayoutsMenu state={fakeState} battlemapsRef={{ current: [] }} />);

describe('LayoutsMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });


  it('refetches the layout list when a LayoutModel permission_update arrives', async () => {
    WebHelper.get.mockImplementation((path, cb) => cb([]));
    render();

    await waitFor(() => expect(WebHelper.get).toHaveBeenCalledTimes(1));

    WebHelper.get.mockImplementation((path, cb) => cb([{ id: 'layout-A', name: 'Shared layout' }]));
    act(() => subHandlers['permission_update']({ data: { id: 'layout-A', entityType: 'LayoutModel' } }));

    await waitFor(() => expect(WebHelper.get).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Shared layout')).toBeInTheDocument();
  });

  it('ignores permission_update events for other entity types', async () => {
    WebHelper.get.mockImplementation((path, cb) => cb([]));
    render();

    await waitFor(() => expect(WebHelper.get).toHaveBeenCalledTimes(1));

    act(() => subHandlers['permission_update']({ data: { id: 'card-1', entityType: 'CardModel' } }));

    // Give any (incorrect) refetch a chance to fire before asserting it didn't.
    await new Promise((r) => setTimeout(r, 0));
    expect(WebHelper.get).toHaveBeenCalledTimes(1);
  });
});
