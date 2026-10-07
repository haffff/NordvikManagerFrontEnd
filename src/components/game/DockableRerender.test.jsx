import React from 'react';
import { render, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import * as Dockable from '@hlorenzi/react-dockable';

// Every dock commit (a click in any panel, every mouse move while a panel is dragged
// or resized) re-rendered the content of EVERY panel: the content context got a new
// value each time, so anything reading it (BasePanel, the Battlemap) re-rendered —
// the battlemap re-rendered on every click in the app. A panel's content should only
// re-render when something about its own panel changes.

const renders = { A: 0, B: 0 };

const Probe = ({ name }) => {
  renders[name] += 1;
  const ctx = Dockable.useContentContext();
  return <div data-testid={name}>{ctx.layoutContent.layoutPanel.rect.w}</div>;
};

function setup() {
  const handle = {};
  const Harness = () => {
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
    return <Dockable.Container state={state} />;
  };
  const utils = render(<Harness />);
  return { ...utils, handle };
}

describe('dock content re-renders', () => {
  beforeEach(() => {
    renders.A = 0;
    renders.B = 0;
  });

  it('a click in another panel does not re-render this panel', () => {
    const { getByTestId } = setup();
    const before = renders.A;

    fireEvent.mouseDown(getByTestId('B'));

    expect(renders.A).toBe(before);
  });

  it('other dock commits (e.g. dragging another panel) do not re-render it', () => {
    const { handle } = setup();
    const before = renders.A;

    act(() => {
      handle.b.rect = new Dockable.Rect(320, 10, 200, 100);
      handle.state.commit();
    });
    act(() => handle.state.commit());

    expect(renders.A).toBe(before);
  });

  it('moving this panel without resizing it does not re-render it', () => {
    const { handle } = setup();
    const before = renders.A;

    act(() => {
      handle.a.rect = new Dockable.Rect(50, 40, 200, 100);
      handle.state.commit();
    });

    expect(renders.A).toBe(before);
  });

  it('resizing this panel does re-render it, with the new size', () => {
    const { handle, getByTestId } = setup();
    const before = renders.A;

    act(() => {
      handle.a.rect = new Dockable.Rect(0, 0, 260, 100);
      handle.state.commit();
    });

    expect(renders.A).toBeGreaterThan(before);
    expect(getByTestId('A').textContent).toBe('260');
  });
});
