import React from 'react';
import { render, act, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as Dockable from '@hlorenzi/react-dockable';

// Minimizing a floating window hides it but must keep its content mounted (the
// battlemap, chat or a card would otherwise lose their state on every minimize).
// Docking a dragged window only happens while the dock modifier is held.

const mounts = { A: 0, B: 0 };
const unmounts = { A: 0, B: 0 };

const Probe = ({ name }) => {
  React.useEffect(() => {
    mounts[name] += 1;
    return () => { unmounts[name] += 1; };
  }, [name]);
  return <div data-testid={name}>{name}</div>;
};

function setup(containerProps = {}) {
  const handle = {};
  const Harness = (props) => {
    const state = Dockable.useDockable((s) => {
      const a = Dockable.makePanel(s);
      Dockable.addNewContent(s, a, <Probe name="A" />);
      a.rect = new Dockable.Rect(0, 0, 200, 100);
      const b = Dockable.makePanel(s);
      Dockable.addNewContent(s, b, <Probe name="B" />);
      b.rect = new Dockable.Rect(300, 0, 200, 100);
      handle.a = a;
      handle.b = b;
    });
    handle.state = state;
    return <Dockable.Container state={state} {...props} />;
  };
  const utils = render(<Harness {...containerProps} />);
  return { ...utils, handle, Harness };
}

// The drag handler throttles to animation frames; run them on demand.
let frames = [];
const flushFrames = () => act(() => {
  const pending = frames;
  frames = [];
  pending.forEach((cb) => cb(0));
});

beforeEach(() => {
  mounts.A = mounts.B = 0;
  unmounts.A = unmounts.B = 0;
  frames = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb));
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const tabOf = (panel) => screen.getByText(`Content ${panel.contentList[0].contentId}`);

// Drags panel A's tab onto the centre of panel B (its "dock as tab" anchor).
function dragAOntoB(handle, keys = {}) {
  const tab = tabOf(handle.a);
  fireEvent.mouseDown(tab, { clientX: 20, clientY: 10, pageX: 20, pageY: 10, ...keys });
  for (const [x, y] of [[100, 30], [300, 40], [400, 50]]) {
    fireEvent.mouseMove(window, { clientX: x, clientY: y, pageX: x, pageY: y, ...keys });
    flushFrames();
  }
  const anchorsShown = handle.state.ref.current.showAnchors;
  const preview = handle.state.ref.current.previewAnchor;
  fireEvent.mouseUp(window, { clientX: 400, clientY: 50, pageX: 400, pageY: 50, ...keys });
  return { anchorsShown, preview };
}

describe('minimizing floating windows', () => {
  it('hides the window but keeps its content mounted', () => {
    const { handle } = setup();
    expect(mounts.A).toBe(1);

    fireEvent.click(screen.getAllByTitle('Minimize')[0]);

    expect(handle.a.isMinimized).toBe(true);
    expect(Dockable.getMinimizedPanels(handle.state.ref.current)).toEqual([handle.a]);
    // The header is gone, the content element is still there, never remounted.
    expect(screen.queryByText(`Content ${handle.a.contentList[0].contentId}`)).toBeNull();
    expect(screen.getByTestId('A')).toBeTruthy();
    expect(unmounts.A).toBe(0);
    expect(mounts.A).toBe(1);
  });

  it('restoring shows the window again and makes it active', () => {
    const { handle } = setup();
    act(() => {
      Dockable.minimizePanel(handle.state.ref.current, handle.a);
      handle.state.commit();
    });

    act(() => {
      Dockable.restorePanel(handle.state.ref.current, handle.a);
      handle.state.commit();
    });

    expect(handle.a.isMinimized).toBe(false);
    expect(handle.state.ref.current.activePanel).toBe(handle.a);
    expect(tabOf(handle.a)).toBeTruthy();
    expect(mounts.A).toBe(1);
    expect(unmounts.A).toBe(0);
  });

  it('a click elsewhere does not make a minimized window active', () => {
    const { handle } = setup();
    act(() => {
      Dockable.minimizePanel(handle.state.ref.current, handle.a);
      handle.state.commit();
    });

    act(() => {
      Dockable.setPanelActiveAndBringToFront(handle.state.ref.current, handle.a);
      handle.state.commit();
    });

    expect(handle.a.isMinimized).toBe(true);
    expect(handle.state.ref.current.activePanel).not.toBe(handle.a);
  });

  it('closePanel removes a minimized window', () => {
    const { handle } = setup();
    act(() => {
      Dockable.minimizePanel(handle.state.ref.current, handle.a);
      Dockable.closePanel(handle.state.ref.current, handle.a);
      handle.state.commit();
    });

    expect(handle.state.ref.current.floatingPanels).toEqual([handle.b]);
    expect(unmounts.A).toBe(1);
  });

  it('only floating windows can be minimized', () => {
    const { handle } = setup();
    const root = handle.state.ref.current.rootPanel;
    Dockable.minimizePanel(handle.state.ref.current, root);
    expect(root.isMinimized).toBe(false);
  });
});

describe('hold-to-dock', () => {
  it('dropping onto an anchor without the modifier leaves the window floating', () => {
    const { handle } = setup();

    const { anchorsShown, preview } = dragAOntoB(handle);

    expect(anchorsShown).toBe(false);
    expect(preview).toBeNull();
    expect(handle.state.ref.current.floatingPanels).toHaveLength(2);
    expect(handle.b.contentList).toHaveLength(1);
  });

  it('holding Shift (the default) docks it', () => {
    const { handle } = setup();

    const { anchorsShown, preview } = dragAOntoB(handle, { shiftKey: true });

    expect(anchorsShown).toBe(true);
    expect(preview?.panel).toBe(handle.b);
    expect(handle.b.contentList).toHaveLength(2);
    expect(handle.state.ref.current.floatingPanels).toEqual([handle.b]);
  });

  // Separate renders: a drop clamps every floating window into the (0×0, in jsdom)
  // container, which would move B away from where the second drag aims.
  it('uses the configured modifier instead of Shift', () => {
    const first = setup({ dockModifier: 'Ctrl' });
    dragAOntoB(first.handle, { shiftKey: true });
    expect(first.handle.b.contentList).toHaveLength(1);
    first.unmount();

    const second = setup({ dockModifier: 'Ctrl' });
    dragAOntoB(second.handle, { ctrlKey: true });
    expect(second.handle.b.contentList).toHaveLength(2);
  });

  it('"None" docks without any key, like before', () => {
    const { handle } = setup({ dockModifier: 'None' });

    dragAOntoB(handle);

    expect(handle.b.contentList).toHaveLength(2);
  });

  it('pressing the modifier mid-drag shows the anchors without moving the mouse', () => {
    const { handle } = setup();
    const tab = tabOf(handle.a);
    fireEvent.mouseDown(tab, { clientX: 20, clientY: 10, pageX: 20, pageY: 10 });
    fireEvent.mouseMove(window, { clientX: 400, clientY: 50, pageX: 400, pageY: 50 });
    flushFrames();
    expect(handle.state.ref.current.showAnchors).toBe(false);

    fireEvent.keyDown(window, { key: 'Shift', shiftKey: true });
    flushFrames();

    expect(handle.state.ref.current.showAnchors).toBe(true);
    expect(handle.state.ref.current.previewAnchor?.panel).toBe(handle.b);
    fireEvent.mouseUp(window, { clientX: 400, clientY: 50, pageX: 400, pageY: 50, shiftKey: true });
  });
});

describe('panel header', () => {
  it('floating windows show more / minimize / close; Pop out, Lock, Hide header are in the menu', () => {
    setup({ onPopOut: () => {} });

    expect(screen.getAllByTitle('Minimize')).toHaveLength(2);
    expect(screen.queryByTitle('Pop Out to Window')).toBeNull();

    fireEvent.click(screen.getAllByTitle('More')[0]);

    expect(screen.getByText('Pop out to window')).toBeTruthy();
    expect(screen.getByText('Lock position')).toBeTruthy();
    expect(screen.getByText('Hide header')).toBeTruthy();
  });

  it('locking from the menu shows the lock badge and closes the menu', () => {
    const { handle } = setup();

    fireEvent.click(screen.getAllByTitle('More')[0]);
    fireEvent.click(screen.getByText('Lock position'));

    expect(handle.a.isLocked).toBe(true);
    expect(screen.getByTitle('Position locked')).toBeTruthy();
    expect(screen.queryByText('Hide header')).toBeNull();
  });

  it('the menu closes on Escape', () => {
    setup();
    fireEvent.click(screen.getAllByTitle('More')[0]);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Hide header')).toBeNull();
  });
});
