import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setTurnOrderState } from '../../game/turnOrder/turnOrderStore';
import { CurrentTurnOverlay } from './CurrentTurnOverlay';

const token = (id, left) => ({ id, getBoundingRect: () => ({ left, top: 20, width: 50, height: 50 }) });

function setup(objects) {
  const wrapperEl = document.createElement('div');
  document.body.appendChild(wrapperEl);
  const canvas = { wrapperEl, getObjects: () => objects };
  render(<CurrentTurnOverlay canvas={canvas} />);
  return { wrapperEl };
}

const turnOf = (elementId, extra = {}) =>
  act(() => setTurnOrderState({ mapId: 'map-1', round: 1, currentEntryId: 'e1', entries: [{ id: 'e1', name: 'x', elementId }], ...extra }));

describe('CurrentTurnOverlay', () => {
  beforeEach(() => act(() => setTurnOrderState(null)));
  afterEach(() => { document.body.innerHTML = ''; });

  it("rings the token whose turn it is", async () => {
    setup([token('t1', 100), token('t2', 300)]);

    turnOf('t2');

    const ring = await screen.findByLabelText('Current turn');
    await waitFor(() => expect(ring.style.left).toBe('296px')); // 4px outside the token
  });

  it('shows nothing for a free entry, a hidden turn, or a token on another map', async () => {
    setup([token('t1', 100)]);

    turnOf(null);
    expect(screen.queryByLabelText('Current turn')).toBeNull();

    turnOf('t1', { currentEntryId: null, currentHidden: true });
    expect(screen.queryByLabelText('Current turn')).toBeNull();

    turnOf('not-here');
    expect(screen.queryByLabelText('Current turn')).toBeNull();
  });
});
