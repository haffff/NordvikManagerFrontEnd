import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Plain stand-ins for the menu parts, so nesting can be read off the DOM.
vi.mock('../../../uiComponents/base/DDItems/DropDownMenu', () => ({
  DropDownMenu: ({ name, children }) => <div data-testid={`menu-${name}`}>{children}</div>,
}));
vi.mock('../../../uiComponents/base/DDItems/DropDownItem', () => ({
  DropDownItem: ({ name, onClick }) => <button onClick={onClick}>{name}</button>,
}));
let entries;
vi.mock('./useMapTree', async (importOriginal) => ({
  ...(await importOriginal()),
  useMapTree: () => entries,
}));
const send = vi.fn();
vi.mock('../../../../helpers/transport', () => ({ ActiveTransportManager: { Send: (...a) => send(...a) } }));

import SwitchMapSubmenu from './SwitchMapSubmenu';

const maps = [{ id: 'm1', name: 'Forest' }, { id: 'm2', name: 'Cave' }];

describe('SwitchMapSubmenu', () => {
  beforeEach(() => { entries = null; send.mockReset(); });

  it('shows a folder as a submenu holding its maps', () => {
    entries = [
      { id: 'f1', name: 'Dungeons', isFolder: true, head: true, next: 'e1' },
      { id: 'e2', targetId: 'm2', parentId: 'f1', head: true },
      { id: 'e1', targetId: 'm1' },
    ];
    render(<SwitchMapSubmenu maps={maps} battleMapId="bm" />);
    const dungeons = screen.getByTestId('menu-Dungeons');
    expect(dungeons).toContainElement(screen.getByText('Cave'));
    expect(dungeons).not.toContainElement(screen.getByText('Forest'));
  });

  it('without a tree, lists the maps flat', () => {
    render(<SwitchMapSubmenu maps={maps} battleMapId="bm" />);
    expect(screen.getByText('Forest')).toBeInTheDocument();
    expect(screen.getByText('Cave')).toBeInTheDocument();
  });

  it('a map inside a folder still switches the battlemap to it', () => {
    entries = [
      { id: 'f1', name: 'Dungeons', isFolder: true, head: true },
      { id: 'e2', targetId: 'm2', parentId: 'f1', head: true },
    ];
    render(<SwitchMapSubmenu maps={maps} battleMapId="bm" />);
    fireEvent.click(screen.getByText('Cave'));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ command: 'map_change' }));
    expect(JSON.stringify(send.mock.calls[0][0])).toContain('m2');
  });
});
