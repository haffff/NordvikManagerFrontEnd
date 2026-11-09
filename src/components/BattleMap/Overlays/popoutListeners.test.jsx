import React from 'react';
import { act, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderWithProviders } from '../../../setupTests';

const { mediator } = vi.hoisted(() => ({ mediator: { selection: null, popup: null } }));

vi.mock('../../../ClientMediator', () => ({
  default: {
    register: vi.fn((client) => { mediator.popup = client; }),
    unregister: vi.fn(),
    sendCommand: vi.fn(),
    sendCommandAsync: vi.fn(() => Promise.resolve([])),
    sendCommandWaitForRegister: vi.fn((panel, command, data) => {
      if (command === 'SubscribeSelectionChanged') mediator.selection = data.method;
    }),
  },
}));
vi.mock('../../uiComponents/hooks/useClientMediator', () => ({ useClientMediator: vi.fn() }));
vi.mock('../../uiComponents/MaterialChooser', () => ({ MaterialChooser: () => null }));
vi.mock('./tokenPropertyIO', () => ({
  resolveTokenParentId: vi.fn(() => 'card-1'),
  writeTokenProperty: vi.fn(),
}));

import ClientMediator from '../../../ClientMediator';
import { BrowserWindowPortal } from '../../uiComponents/base/BrowserWindowPortal';
import { PickPointOverlay } from './PickPointOverlay';
import { PopupBMOverlay } from './PopupBMOverlay';
import { TokenQuickEditOverlay } from './TokenQuickEditOverlay';

// The overlays of a popped-out map have to hear that window's keyboard and mouse.
let frame;
let popout;

const renderInPopout = async (ui) => {
  renderWithProviders(
    <BrowserWindowPortal title="Map">
      <span data-ready="" />
      {ui}
    </BrowserWindowPortal>,
  );
  await waitFor(() => expect(popout.document.querySelector('[data-ready]')).toBeTruthy());
};

beforeEach(() => {
  vi.clearAllMocks();
  frame = document.createElement('iframe');
  document.body.appendChild(frame);
  popout = frame.contentWindow;
  vi.spyOn(window, 'open').mockReturnValue(popout);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  frame.remove();
});

describe('token quick edit in a popped-out window', () => {
  const openPanel = async () => {
    const token = {
      id: 'tok-1',
      getBoundingRect: () => ({ left: 10, top: 10, width: 50, height: 50 }),
      tokenData: { editableProps: [{ name: 'hp', dtoProperty: 'hp', label: 'HP', source: 'card' }] },
    };
    const canvas = {
      get wrapperEl() { return popout.document.body; },
      getObjects: () => [token],
      on: vi.fn(),
      off: vi.fn(),
    };
    await renderInPopout(<TokenQuickEditOverlay battleMapId="map-1" canvas={canvas} />);
    act(() => mediator.selection({ selected: [token] }));
    const gear = await waitFor(() => {
      const found = popout.document.querySelector('[aria-label="Token settings"]');
      expect(found).toBeTruthy();
      return found;
    });
    fireEvent.click(gear);
    await waitFor(() => expect(panel()).toBeTruthy());
  };
  const panel = () => popout.document.querySelector('[aria-label="Token values"]');

  it('closes on Esc', async () => {
    await openPanel();

    fireEvent.keyDown(popout.document.body, { key: 'Escape' });

    await waitFor(() => expect(Boolean(panel())).toBe(false));
  });

  it('closes on a click outside', async () => {
    await openPanel();

    fireEvent.mouseDown(popout.document.body);

    await waitFor(() => expect(Boolean(panel())).toBe(false));
  });
});

describe('picking a point in a popped-out window', () => {
  it('cancels on Esc', async () => {
    const pointing = { state: {}, listeners: new Set() };
    await renderInPopout(<PickPointOverlay battleMapId="map-1" pointing={pointing} />);

    fireEvent.keyDown(popout.document.body, { key: 'Escape' });

    expect(ClientMediator.sendCommand).toHaveBeenCalledWith('BattleMap', 'CancelPickPoint', { contextId: 'map-1' });
  });
});

describe('the map popup in a popped-out window', () => {
  it('follows the mouse', async () => {
    await renderInPopout(<PopupBMOverlay battleMapId="map-1" />);
    act(() => mediator.popup.ShowPopup({ content: 'tooltip' }));

    fireEvent.mouseMove(popout.document.body, { clientX: 40, clientY: 30 });

    const popup = popout.document.querySelector('.nm_bm_popup');
    expect(popup.style.left).toBe('40px');
    expect(popup.style.top).toBe('30px');
  });
});
