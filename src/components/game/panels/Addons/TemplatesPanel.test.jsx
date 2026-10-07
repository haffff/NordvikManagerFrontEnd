import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../../../setupTests';

// The templates panel shows its templates in a folder tree (tree entries labelled "CardTemplate").

const syncerProps = {};
vi.mock('../../../uiComponents/base/CollectionSyncer', () => ({
  default: (props) => { Object.assign(syncerProps, props); return null; },
}));
vi.mock('../../../uiComponents/base/Subscribable', () => ({ default: () => null }));
vi.mock('../../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));
vi.mock('../../../uiComponents/base/Modals/InputModal', () => ({ default: () => null }));
const { editorProps } = vi.hoisted(() => ({ editorProps: {} }));
vi.mock('../../settings/SettingsPanelWithPropertySettings', () => ({
  SettingsPanelWithPropertySettings: (props) => {
    Object.assign(editorProps, props);
    return <div data-testid="settings">Editing {props.dto.name}</div>;
  },
}));
vi.mock('@hlorenzi/react-dockable', () => ({
  useContentContext: () => ({ setTitle: vi.fn() }),
}));
vi.mock('../../../../ClientMediator', () => ({
  default: {
    sendCommand: vi.fn((panel, cmd) => (cmd === 'GetGameId' ? 'game-1' : undefined)),
    sendCommandAsync: vi.fn(async (panel, cmd) => (cmd === 'GetGameId' ? 'game-1' : undefined)),
  },
}));

const views = [
  { id: 'v1', name: 'Initiative tracker' },
  { id: 'v2', name: 'Loot table', isHidden: true },
]; // template names reuse the same fixtures
const tree = [
  { id: 'f-ui', isFolder: true, name: 'Combat UI', head: true, next: 'e-v2', entryType: 'CardTemplate' },
  { id: 'e-v2', targetId: 'v2', entryType: 'CardTemplate' },
  { id: 'e-v1', targetId: 'v1', head: true, parentId: 'f-ui', entryType: 'CardTemplate' },
];

vi.mock('../../../../helpers/transport', () => ({
  ActiveWebHelper: {
    getAsync: vi.fn(),
    get: vi.fn(),
  },
  ActiveTransportManager: { Send: vi.fn() },
}));

import { ActiveWebHelper as WebHelper } from '../../../../helpers/transport';
import { TemplatesPanel } from './TemplatesPanel';

const treeRequests = () => WebHelper.get.mock.calls.filter(([url]) => url.startsWith('battlemap/getTree'));

describe('TemplatesPanel folder tree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    WebHelper.getAsync.mockImplementation(async (url) => (url.startsWith('materials/GetTemplatesFull') ? views : null));
    WebHelper.get.mockImplementation((url, ok) => { if (url.startsWith('battlemap/getTree')) ok(tree); });
  });

  it('loads the template folder tree', async () => {
    renderWithProviders(<TemplatesPanel />);
    await waitFor(() => expect(treeRequests().length).toBeGreaterThan(0));
    expect(treeRequests()[0][0]).toBe('battlemap/getTree?entityType=CardTemplate');
  });

  it('shows templates inside their folders', async () => {
    renderWithProviders(<TemplatesPanel />);
    expect(await screen.findByText('Combat UI')).toBeInTheDocument();
    expect(screen.getByText('Loot table')).toBeInTheDocument();
    expect(screen.queryByText('Initiative tracker')).not.toBeInTheDocument(); // folder closed
    fireEvent.doubleClick(screen.getByText('Combat UI'));
    expect(await screen.findByText('Initiative tracker')).toBeInTheDocument();
  });

  it('selecting a template opens it in the detail pane', async () => {
    renderWithProviders(<TemplatesPanel />);
    fireEvent.click(await screen.findByText('Loot table'));
    expect(await screen.findByTestId('settings')).toHaveTextContent('Editing Loot table');
  });

  it('refreshes the tree when a template is added', async () => {
    renderWithProviders(<TemplatesPanel />);
    await screen.findByText('Loot table');
    const before = treeRequests().length;
    act(() => syncerProps.onAdd?.({ id: 'v3', name: 'New Template' }));
    await waitFor(() => expect(treeRequests().length).toBeGreaterThan(before));
  });

  // Hidden templates are left out of pickers but still managed here.
  it('marks hidden templates', async () => {
    renderWithProviders(<TemplatesPanel />);
    await screen.findByText('Loot table');

    expect(screen.getByText('hidden')).toBeInTheDocument();
  });

  it('the template editor has a Hidden switch', async () => {
    renderWithProviders(<TemplatesPanel />);
    fireEvent.click(await screen.findByText('Loot table'));
    await screen.findByTestId('settings');

    expect(editorProps.editableKeyLabelDict).toContainEqual(expect.objectContaining({ key: 'isHidden', type: 'boolean' }));
  });
});
