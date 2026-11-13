import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CollectionSyncer } from './CollectionSyncer';

// Capture the onMessage callback registered by the rendered CollectionSyncer.
// vi.mock is hoisted; the factory runs lazily on first import, by which time this
// module-level variable is already initialised.
let capturedOnMessage;
vi.mock('./Subscribable', () => ({
  default: ({ onMessage }) => {
    capturedOnMessage = onMessage;
    return null;
  },
}));

/**
 * Host component: renders CollectionSyncer alongside a visible list so we can
 * assert on the resulting DOM after events are fired.
 */
const Host = ({ initialItems = [], ...props }) => {
  const [items, setItems] = React.useState(initialItems);
  return (
    <div>
      <CollectionSyncer
        collection={items}
        setCollection={setItems}
        commandPrefix="item"
        {...props}
      />
      <ul>
        {items.map((x) => (
          <li key={x.id} data-testid={`item-${x.id}`}>
            <span data-testid={`name-${x.id}`}>{x.name}</span>
            {x.extra !== undefined && (
              <span data-testid={`extra-${x.id}`}>{x.extra}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Synchronously dispatch a simulated websocket event. */
const fire = (event) => act(() => { capturedOnMessage(event); });

describe('CollectionSyncer', () => {
  beforeEach(() => {
    capturedOnMessage = undefined;
  });

  // What the list shows: "id:name", plus ":extra" when the item has one.
  const shown = () => screen.queryAllByRole('listitem').map((li) => {
    const id = li.dataset.testid.slice('item-'.length);
    const extra = screen.queryByTestId(`extra-${id}`);
    return [id, screen.getByTestId(`name-${id}`).textContent, ...(extra ? [extra.textContent] : [])].join(':');
  });

  // A new list each time: the syncer changes the collection it's given in place.
  const forest = () => [{ id: '1', name: 'Forest' }];

  it.each([
    ['appends a new item on {prefix}_add', {}, [], { command: 'item_add', data: { id: '1', name: 'Forest' } }, ['1:Forest']],
    ['appends a new item via custom addCommand', { addCommand: 'custom_add' }, [], { command: 'custom_add', data: { id: '2', name: 'Castle' } }, ['2:Castle']],
    ['replaces an item on {prefix}_update', {}, [{ id: '1', name: 'Old Name' }], { command: 'item_update', data: { id: '1', name: 'New Name' } }, ['1:New Name']],
    // incrementalUpdate merges, so the extra field is kept
    ['merges fields when incrementalUpdate=true', { incrementalUpdate: true }, [{ id: '1', name: 'Forest', extra: 'keep me' }], { command: 'item_update', data: { id: '1', name: 'Updated' } }, ['1:Updated:keep me']],
    ['removes extra fields on update without incrementalUpdate', {}, [{ id: '1', name: 'Forest', extra: 'lose me' }], { command: 'item_update', data: { id: '1', name: 'Updated' } }, ['1:Updated']],
    ['does not modify collection when the updated id is not found', {}, forest(), { command: 'item_update', data: { id: 'ghost', name: 'X' } }, ['1:Forest']],
    ['removes an item on {prefix}_delete', {}, [...forest(), { id: '2', name: 'Cave' }], { command: 'item_delete', data: '1' }, ['2:Cave']],
    ['removes an item on {prefix}_remove alias', {}, forest(), { command: 'item_remove', data: '1' }, []],
    ['removes an item via custom deleteCommand', { deleteCommand: 'custom_delete' }, forest(), { command: 'custom_delete', data: '1' }, []],
    ['ignores all events when paused=true', { paused: true }, [], { command: 'item_add', data: { id: '1', name: 'Ghost' } }, []],
    ['ignores events with a non-Ok error result', {}, [], { command: 'item_add', data: { id: '1', name: 'Ghost' }, result: 'NoPermission' }, []],
  ])('%s', (_name, props, initialItems, event, expected) => {
    render(<Host initialItems={initialItems} {...props} />);
    fire(event);
    expect(shown()).toEqual(expected);
  });

  // Each change calls its own callback with what it got, and onAnyChange once.
  it.each([
    ['onAdd on {prefix}_add', 'onAdd', {}, [], { command: 'item_add', data: { id: '1', name: 'Forest' } }, { id: '1', name: 'Forest' }],
    ['onUpdate on {prefix}_update', 'onUpdate', {}, forest(), { command: 'item_update', data: { id: '1', name: 'New' } }, { id: '1', name: 'New' }],
    ['onDelete on {prefix}_delete', 'onDelete', {}, forest(), { command: 'item_delete', data: '1' }, '1'],
    ['onSelectedChanged on selectItemCommand', 'onSelectedChanged', { selectItemCommand: 'item_pick' }, forest(), { command: 'item_pick', data: { id: '1' } }, { id: '1' }],
  ])('calls %s, and onAnyChange', (_name, callback, props, initialItems, event, expected) => {
    const handler = vi.fn();
    const onAnyChange = vi.fn();
    render(<Host initialItems={initialItems} {...props} {...{ [callback]: handler }} onAnyChange={onAnyChange} />);
    fire(event);
    expect(handler).toHaveBeenCalledWith(expected, expect.any(Object));
    expect(onAnyChange).toHaveBeenCalledTimes(1);
  });

  it('calls setSelectedItem with the matching collection item', () => {
    const setSelectedItem = vi.fn();
    render(<Host initialItems={forest()} selectItemCommand="item_pick" setSelectedItem={setSelectedItem} />);
    fire({ command: 'item_pick', data: { id: '1' } });
    expect(setSelectedItem).toHaveBeenCalledWith({ id: '1', name: 'Forest' });
  });

  it('calls onAnyChange on select, also without onSelectedChanged', () => {
    const onAnyChange = vi.fn();
    render(<Host initialItems={forest()} selectItemCommand="item_pick" onAnyChange={onAnyChange} />);
    fire({ command: 'item_pick', data: { id: '1' } });
    expect(onAnyChange).toHaveBeenCalledTimes(1);
  });

  it('does not call onAnyChange for unrecognised commands', () => {
    const onAnyChange = vi.fn();
    render(<Host onAnyChange={onAnyChange} />);
    fire({ command: 'something_totally_different', data: {} });
    expect(onAnyChange).not.toHaveBeenCalled();
  });
});
