import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as React from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../setupTests';
import { SplitPane, useSplitView } from './SplitPane';

// jsdom lays nothing out: the pane's width comes from a stubbed clientWidth, and a fake
// ResizeObserver reports it when the test says the pane was resized.
let observers = [];
let paneWidth = 0;
class FakeResizeObserver {
  constructor(cb) { this.cb = cb; observers.push(this); }
  observe() {}
  disconnect() {}
}
const resizeTo = (w) => act(() => { paneWidth = w; observers.forEach((o) => o.cb([])); });

const List = ({ onPick }) => {
  const [count, setCount] = React.useState(0);
  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>list clicks {count}</button>
      <button onClick={onPick}>Goblin</button>
    </div>
  );
};

function Panel({ initialDetail = null }) {
  const [detail, setDetail] = React.useState(initialDetail);
  const split = useSplitView(initialDetail ? 'detail' : 'list');
  return (
    <SplitPane
      split={split}
      list={<List onPick={() => { setDetail('Goblin'); split.showDetail(); }} />}
      detail={detail ? <div>detail of {detail}</div> : <div>nothing selected</div>}
      backLabel="Cards"
    />
  );
}

describe('SplitPane', () => {
  beforeEach(() => {
    observers = [];
    paneWidth = 0;
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => paneWidth);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows the list and the detail side by side when there is room', () => {
    paneWidth = 900;
    renderWithProviders(<Panel initialDetail="Goblin" />);
    expect(screen.getByText('Goblin')).toBeVisible();
    expect(screen.getByText('detail of Goblin')).toBeVisible();
    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();
  });

  it("is side by side in a new desktop window (the dock opens them 500px wide)", () => {
    paneWidth = 490;
    renderWithProviders(<Panel initialDetail="Goblin" />);
    expect(screen.getByText('Goblin')).toBeVisible();
    expect(screen.getByText('detail of Goblin')).toBeVisible();
  });

  it('is side by side while its width is unknown (not laid out, or hidden)', () => {
    paneWidth = 0;
    renderWithProviders(<Panel initialDetail="Goblin" />);
    expect(screen.getByText('Goblin')).toBeVisible();
    expect(screen.getByText('detail of Goblin')).toBeVisible();
  });

  it('when narrow shows the list, then the picked entry with a way back', () => {
    paneWidth = 360;
    renderWithProviders(<Panel />);
    expect(screen.getByText('Goblin')).toBeVisible();
    expect(screen.getByText('nothing selected')).not.toBeVisible();

    fireEvent.click(screen.getByText('Goblin'));
    expect(screen.getByText('detail of Goblin')).toBeVisible();
    expect(screen.getByText('Goblin')).not.toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /back to cards/i }));
    expect(screen.getByText('Goblin')).toBeVisible();
    expect(screen.getByText('detail of Goblin')).not.toBeVisible();
  });

  it('opens the same entry again after Back when its row is tapped', () => {
    paneWidth = 360;
    renderWithProviders(<Panel initialDetail="Goblin" />);
    expect(screen.getByText('detail of Goblin')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /back to cards/i }));
    fireEvent.click(screen.getByText('Goblin')); // same entry: the panel's selection doesn't change
    expect(screen.getByText('detail of Goblin')).toBeVisible();
  });

  it('keeps the list mounted, with its state, while the detail is shown and on resize', () => {
    paneWidth = 900;
    renderWithProviders(<Panel />);
    fireEvent.click(screen.getByText('list clicks 0'));

    resizeTo(360);
    fireEvent.click(screen.getByText('Goblin'));
    fireEvent.click(screen.getByRole('button', { name: /back to cards/i }));
    expect(screen.getByText('list clicks 1')).toBeVisible();

    resizeTo(900);
    expect(screen.getByText('list clicks 1')).toBeVisible();
    expect(screen.getByText('detail of Goblin')).toBeVisible();
  });

  it("draws the panel's own divider when wide, and none when narrow", () => {
    paneWidth = 900;
    function WithDivider() {
      const split = useSplitView();
      return (
        <SplitPane split={split} list={<div>l</div>} detail={<div>d</div>}
          renderDivider={(onMouseDown) => <div data-testid="divider" onMouseDown={onMouseDown} />} />
      );
    }
    renderWithProviders(<WithDivider />);
    expect(screen.getByTestId('divider')).toBeVisible();
    resizeTo(360);
    expect(screen.getByTestId('divider')).not.toBeVisible();
  });
});
