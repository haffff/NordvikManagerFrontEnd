import React from 'react';
import { render, act, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import * as Dockable from '@hlorenzi/react-dockable';
import MinimizedWindowsBar from './MinimizedWindowsBar';

function setup() {
  const handle = {};
  const Harness = () => {
    const state = Dockable.useDockable((s) => {
      const a = Dockable.makePanel(s);
      Dockable.addNewContent(s, a, <div>A</div>);
      a.contentList[0].title = 'Chat';
      const b = Dockable.makePanel(s);
      Dockable.addNewContent(s, b, <div>B</div>);
      Dockable.addNewContent(s, b, <div>B2</div>);
      b.contentList[0].title = 'Cards';
      b.currentTabIndex = 0;
      handle.a = a;
      handle.b = b;
    });
    handle.state = state;
    return <MinimizedWindowsBar state={state} />;
  };
  const utils = render(<Harness />);
  const minimize = (panel) => act(() => {
    Dockable.minimizePanel(handle.state.ref.current, panel);
    handle.state.commit();
  });
  return { ...utils, handle, minimize };
}

describe('MinimizedWindowsBar', () => {
  it('renders nothing while no window is minimized', () => {
    const { container } = setup();
    expect(container.innerHTML).toBe('');
  });

  it('shows a chip per minimized window, with its title and extra tab count', () => {
    const { handle, minimize } = setup();
    minimize(handle.a);
    minimize(handle.b);

    expect(screen.getByText('Chat')).toBeTruthy();
    expect(screen.getByText('Cards')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
  });

  it('clicking a chip restores the window', () => {
    const { handle, minimize } = setup();
    minimize(handle.a);

    fireEvent.click(screen.getByTitle('Restore Chat'));

    expect(handle.a.isMinimized).toBe(false);
    expect(screen.queryByText('Chat')).toBeNull();
  });

  it('the chip close button closes the window without restoring it', () => {
    const { handle, minimize } = setup();
    minimize(handle.a);

    fireEvent.click(screen.getByLabelText('Close Chat'));

    expect(handle.state.ref.current.floatingPanels).not.toContain(handle.a);
    expect(screen.queryByText('Chat')).toBeNull();
  });
});
