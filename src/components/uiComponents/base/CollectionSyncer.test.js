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

  // ── add ─────────────────────────────────────────────────────────────────────

  it('appends a new item on {prefix}_add', () => {
    render(<Host />);
    fire({ command: 'item_add', data: { id: '1', name: 'Forest' } });
    expect(screen.getByTestId('item-1')).toHaveTextContent('Forest');
  });

  it('calls onAdd and onAnyChange on {prefix}_add', () => {
    const onAdd = vi.fn();
    const onAnyChange = vi.fn();
    render(<Host onAdd={onAdd} onAnyChange={onAnyChange} />);
    fire({ command: 'item_add', data: { id: '1', name: 'Forest' } });
    expect(onAdd).toHaveBeenCalledWith({ id: '1', name: 'Forest' }, expect.any(Object));
    expect(onAnyChange).toHaveBeenCalledTimes(1);
  });

  it('appends a new item via custom addCommand', () => {
    render(<Host addCommand="custom_add" />);
    fire({ command: 'custom_add', data: { id: '2', name: 'Castle' } });
    expect(screen.getByTestId('item-2')).toBeInTheDocument();
  });

  // ── update ───────────────────────────────────────────────────────────────────

  it('replaces an item on {prefix}_update', () => {
    render(<Host initialItems={[{ id: '1', name: 'Old Name' }]} />);
    fire({ command: 'item_update', data: { id: '1', name: 'New Name' } });
    expect(screen.getByTestId('name-1')).toHaveTextContent('New Name');
  });

  it('merges fields when incrementalUpdate=true', () => {
    render(
      <Host
        initialItems={[{ id: '1', name: 'Forest', extra: 'keep me' }]}
        incrementalUpdate
      />
    );
    fire({ command: 'item_update', data: { id: '1', name: 'Updated' } });
    expect(screen.getByTestId('name-1')).toHaveTextContent('Updated');
    // extra field must be preserved because incrementalUpdate merges
    expect(screen.getByTestId('extra-1')).toHaveTextContent('keep me');
  });

  it('removes extra fields on update without incrementalUpdate', () => {
    render(<Host initialItems={[{ id: '1', name: 'Forest', extra: 'lose me' }]} />);
    fire({ command: 'item_update', data: { id: '1', name: 'Updated' } });
    expect(screen.queryByTestId('extra-1')).not.toBeInTheDocument();
  });

  it('calls onUpdate and onAnyChange on {prefix}_update', () => {
    const onUpdate = vi.fn();
    const onAnyChange = vi.fn();
    render(
      <Host
        initialItems={[{ id: '1', name: 'Forest' }]}
        onUpdate={onUpdate}
        onAnyChange={onAnyChange}
      />
    );
    fire({ command: 'item_update', data: { id: '1', name: 'New' } });
    expect(onUpdate).toHaveBeenCalledWith({ id: '1', name: 'New' }, expect.any(Object));
    expect(onAnyChange).toHaveBeenCalledTimes(1);
  });

  it('does not modify collection when the updated id is not found', () => {
    render(<Host initialItems={[{ id: '1', name: 'Forest' }]} />);
    fire({ command: 'item_update', data: { id: 'ghost', name: 'X' } });
    expect(screen.getByTestId('name-1')).toHaveTextContent('Forest');
  });

  // ── delete / remove ──────────────────────────────────────────────────────────

  it('removes an item on {prefix}_delete', () => {
    render(
      <Host
        initialItems={[
          { id: '1', name: 'Forest' },
          { id: '2', name: 'Cave' },
        ]}
      />
    );
    fire({ command: 'item_delete', data: '1' });
    expect(screen.queryByTestId('item-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('item-2')).toBeInTheDocument();
  });

  it('removes an item on {prefix}_remove alias', () => {
    render(<Host initialItems={[{ id: '1', name: 'Forest' }]} />);
    fire({ command: 'item_remove', data: '1' });
    expect(screen.queryByTestId('item-1')).not.toBeInTheDocument();
  });

  it('removes an item via custom deleteCommand', () => {
    render(<Host initialItems={[{ id: '1', name: 'Forest' }]} deleteCommand="custom_delete" />);
    fire({ command: 'custom_delete', data: '1' });
    expect(screen.queryByTestId('item-1')).not.toBeInTheDocument();
  });

  it('calls onDelete and onAnyChange on {prefix}_delete', () => {
    const onDelete = vi.fn();
    const onAnyChange = vi.fn();
    render(
      <Host
        initialItems={[{ id: '1', name: 'Forest' }]}
        onDelete={onDelete}
        onAnyChange={onAnyChange}
      />
    );
    fire({ command: 'item_delete', data: '1' });
    expect(onDelete).toHaveBeenCalledWith('1', expect.any(Object));
    expect(onAnyChange).toHaveBeenCalledTimes(1);
  });

  // ── select ───────────────────────────────────────────────────────────────────

  it('calls onSelectedChanged on selectItemCommand', () => {
    const onSelectedChanged = vi.fn();
    render(
      <Host
        initialItems={[{ id: '1', name: 'Forest' }]}
        selectItemCommand="item_pick"
        onSelectedChanged={onSelectedChanged}
      />
    );
    fire({ command: 'item_pick', data: { id: '1' } });
    expect(onSelectedChanged).toHaveBeenCalledWith({ id: '1' }, expect.any(Object));
  });

  it('calls setSelectedItem with the matching collection item', () => {
    const setSelectedItem = vi.fn();
    render(
      <Host
        initialItems={[{ id: '1', name: 'Forest' }]}
        selectItemCommand="item_pick"
        setSelectedItem={setSelectedItem}
      />
    );
    fire({ command: 'item_pick', data: { id: '1' } });
    expect(setSelectedItem).toHaveBeenCalledWith({ id: '1', name: 'Forest' });
  });

  it('calls onAnyChange on select', () => {
    const onAnyChange = vi.fn();
    render(
      <Host
        initialItems={[{ id: '1', name: 'Forest' }]}
        selectItemCommand="item_pick"
        onAnyChange={onAnyChange}
      />
    );
    fire({ command: 'item_pick', data: { id: '1' } });
    expect(onAnyChange).toHaveBeenCalledTimes(1);
  });

  // ── edge cases ───────────────────────────────────────────────────────────────

  it('ignores all events when paused=true', () => {
    render(<Host paused />);
    fire({ command: 'item_add', data: { id: '1', name: 'Ghost' } });
    expect(screen.queryByTestId('item-1')).not.toBeInTheDocument();
  });

  it('ignores events with a non-Ok error result', () => {
    render(<Host />);
    fire({ command: 'item_add', data: { id: '1', name: 'Ghost' }, result: 'NoPermission' });
    expect(screen.queryByTestId('item-1')).not.toBeInTheDocument();
  });

  it('does not call onAnyChange for unrecognised commands', () => {
    const onAnyChange = vi.fn();
    render(<Host onAnyChange={onAnyChange} />);
    fire({ command: 'something_totally_different', data: {} });
    expect(onAnyChange).not.toHaveBeenCalled();
  });
});
