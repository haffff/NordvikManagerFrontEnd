import React from 'react';
import { screen, act, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderWithProviders } from '../../../setupTests';

// The selection handler and canvas handlers the overlay registers, so tests can fire them.
const { selection } = vi.hoisted(() => ({ selection: { handler: null } }));

vi.mock('../../../ClientMediator', () => ({
  default: {
    sendCommandWaitForRegister: vi.fn((panel, command, data) => {
      if (command === 'SubscribeSelectionChanged') selection.handler = data.method;
    }),
    sendCommand: vi.fn(),
    sendCommandAsync: vi.fn(() => Promise.resolve([
      { id: 'p1', name: 'bar1_value', value: '5' },
      { id: 'p2', name: 'bar1_max', value: '10' },
      { id: 'p3', name: 'hp', value: '7' },
    ])),
  },
}));
vi.mock('../../uiComponents/hooks/useClientMediator', () => ({ useClientMediator: vi.fn() }));
vi.mock('./tokenPropertyIO', () => ({
  resolveTokenParentId: vi.fn(() => 'card-1'),
  writeTokenProperty: vi.fn(),
}));

// Stands in for the material picker: one button that picks image "img-1".
vi.mock('../../uiComponents/MaterialChooser', () => ({
  MaterialChooser: ({ onSelect }) => <button type="button" onClick={() => onSelect('img-1')}>pick img-1</button>,
}));

import ClientMediator from '../../../ClientMediator';
import { writeTokenProperty } from './tokenPropertyIO';
import { TokenQuickEditOverlay } from './TokenQuickEditOverlay';

const barField = (n, max) => ({
  name: `bar${n}_${max ? 'max' : 'value'}`, dtoProperty: `bar${n}_${max ? 'max' : 'value'}`,
  label: max ? `Bar ${n} max` : `Bar ${n}`, source: 'card', group: `bar${n}`,
});

function setup({ editableProps, assignableIcons = [] } = {}) {
  const canvasHandlers = {};
  const wrapperEl = document.createElement('div');
  document.body.appendChild(wrapperEl);
  const token = {
    id: 'tok-1',
    getBoundingRect: () => ({ left: 10, top: 10, width: 50, height: 50 }),
    tokenData: {
      editableProps: editableProps ?? [barField(1), barField(1, true)],
      assignableIcons,
    },
  };
  const canvas = {
    wrapperEl,
    getObjects: () => [token],
    on: (event, fn) => { canvasHandlers[event] = fn; },
    off: vi.fn(),
  };
  renderWithProviders(<TokenQuickEditOverlay battleMapId="map-1" canvas={canvas} />);
  const select = (objects) => act(() => selection.handler({ selected: objects }));
  return { token, canvasHandlers, select };
}

const gear = () => screen.queryByRole('button', { name: 'Token settings' });
const field = (label) => screen.queryByRole('textbox', { name: label });

describe('TokenQuickEditOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selection.handler = null;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('selecting a token shows only the gear, not the fields', () => {
    const { token, select } = setup();

    select([token]);

    expect(gear()).toBeTruthy();
    expect(field('Bar 1')).toBeNull();
  });

  it('the gear opens the panel; value and max of a group share one row', async () => {
    const { token, select } = setup();
    select([token]);

    await userEvent.click(gear());

    const value = await screen.findByRole('textbox', { name: 'Bar 1' });
    const max = field('Bar 1 max');
    expect(value.closest('[data-row]')).toBe(max.closest('[data-row]'));
    await waitFor(() => expect(value.value).toBe('5'));
  });

  it('fields without a group get a row each', async () => {
    const { token, select } = setup({
      editableProps: [
        { name: 'hp', dtoProperty: 'hp', label: 'HP', source: 'card' },
        { name: 'ac', dtoProperty: 'ac', label: 'AC', source: 'card' },
      ],
    });
    select([token]);
    await userEvent.click(gear());

    const hp = await screen.findByRole('textbox', { name: 'HP' });
    expect(hp.closest('[data-row]')).not.toBe(field('AC').closest('[data-row]'));
  });

  it('Esc closes the panel', async () => {
    const { token, select } = setup();
    select([token]);
    await userEvent.click(gear());
    await screen.findByRole('textbox', { name: 'Bar 1' });

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(field('Bar 1')).toBeNull();
    expect(gear()).toBeTruthy();
  });

  it('a click outside closes the panel; a click inside does not', async () => {
    const { token, select } = setup();
    select([token]);
    await userEvent.click(gear());
    const value = await screen.findByRole('textbox', { name: 'Bar 1' });

    fireEvent.mouseDown(value);
    expect(field('Bar 1')).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(field('Bar 1')).toBeNull();
  });

  it('deselecting removes the gear and the panel', async () => {
    const { token, select } = setup();
    select([token]);
    await userEvent.click(gear());

    select([]);

    expect(gear()).toBeNull();
    expect(field('Bar 1')).toBeNull();
  });

  it('a value is saved when leaving the field', async () => {
    const { token, select } = setup();
    select([token]);
    await userEvent.click(gear());
    const value = await screen.findByRole('textbox', { name: 'Bar 1' });
    await waitFor(() => expect(value.value).toBe('5'));

    await userEvent.clear(value);
    await userEvent.type(value, '3');
    fireEvent.blur(value);

    expect(writeTokenProperty).toHaveBeenCalledWith(expect.objectContaining({ dtoProperty: 'bar1_value', value: '3', existingId: 'p1' }));
  });

  it('"Icons…" opens the icon picker and closes the panel', async () => {
    const { token, select } = setup({ assignableIcons: [{ id: 'poisoned' }] });
    select([token]);
    await userEvent.click(gear());

    await userEvent.click(await screen.findByRole('button', { name: 'Icons…' }));

    expect(ClientMediator.sendCommand).toHaveBeenCalledWith('BattleMap', 'ShowIconPicker', { contextId: 'map-1', tokenId: 'tok-1' });
    expect(field('Bar 1')).toBeNull();
  });

  it('no "Icons…" button when the token has no icons', async () => {
    const { token, select } = setup();
    select([token]);
    await userEvent.click(gear());
    await screen.findByRole('textbox', { name: 'Bar 1' });

    expect(screen.queryByRole('button', { name: 'Icons…' })).toBeNull();
  });

  it('dragging the token hides the gear and panel until the move ends', async () => {
    const { token, select, canvasHandlers } = setup();
    select([token]);
    await userEvent.click(gear());
    await screen.findByRole('textbox', { name: 'Bar 1' });

    act(() => canvasHandlers['object:moving']({ target: token }));
    expect(gear()).toBeNull();
    expect(field('Bar 1')).toBeNull();

    act(() => canvasHandlers['object:modified']({ target: token }));
    expect(gear()).toBeTruthy();
  });

  it('an image field picks a material and saves it on the token', async () => {
    const image = { name: 'tokenImage', dtoProperty: 'tokenImage', label: 'Image', source: 'element', type: 'image' };
    const { token, select } = setup({ editableProps: [image, barField(1)] });
    select([token]);
    await userEvent.click(gear());

    // closed until asked for, so the panel stays small
    expect(screen.queryByText('pick img-1')).toBeNull();
    await userEvent.click(await screen.findByRole('button', { name: 'Choose image' }));
    await userEvent.click(screen.getByText('pick img-1'));

    expect(writeTokenProperty).toHaveBeenCalledWith(expect.objectContaining({
      token, source: 'element', dtoProperty: 'tokenImage', value: 'img-1',
    }));
    expect(screen.queryByText('pick img-1')).toBeNull();
  });

  it("a field's default shows while the token has no value of its own", async () => {
    const showBars = { name: 'mask_bars_enabled', dtoProperty: 'mask_bars_enabled', label: 'Show bars', source: 'element', type: 'boolean', default: true };
    const { token, select } = setup({ editableProps: [showBars, barField(1)] });
    select([token]);
    await userEvent.click(gear());

    const box = await screen.findByRole('checkbox', { name: 'Show bars' });
    await waitFor(() => expect(box).toBeChecked());

    await userEvent.click(box);
    expect(writeTokenProperty).toHaveBeenCalledWith(expect.objectContaining({ dtoProperty: 'mask_bars_enabled', value: false }));
  });
});
