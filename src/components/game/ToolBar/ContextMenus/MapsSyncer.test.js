import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MapsSyncer } from './MapsSyncer';

// One captured handler per prefix, the way Subscribable filters events.
let handlers;
vi.mock('../../../uiComponents/base/Subscribable', () => ({
  default: ({ commandPrefix, onMessage }) => {
    handlers[commandPrefix] = onMessage;
    return null;
  },
}));

const Host = ({ initialMaps }) => {
  const [maps, setMaps] = React.useState(initialMaps);
  return (
    <div>
      <MapsSyncer maps={maps} setMaps={setMaps} />
      {maps.map((m) => <span key={m.id} data-testid={`map-${m.id}`}>{m.name}|{m.gridSize}</span>)}
    </div>
  );
};

// Like the transport: every subscriber whose prefix the command starts with gets it.
const fire = (event) => act(() => {
  Object.entries(handlers).forEach(([prefix, h]) => { if (event.command.startsWith(prefix)) h(event); });
});

describe('MapsSyncer', () => {
  beforeEach(() => { handlers = {}; });

  // settings_map on Forest (grid 50); the list shows "name|grid".
  it.each([
    ['a rename shows in the list', 'Ok', { id: 'a', name: 'Dark Forest' }, 'Dark Forest|50'],
    ['a partial settings_map (grid edit) keeps the name', 'Ok', { id: 'a', gridSize: 70, action: 'gridEdit' }, 'Forest|70'],
    ['ignores a refused rename', 'NoPermission', { id: 'a', name: 'Hacked' }, 'Forest|50'],
  ])('%s', (_name, result, data, shown) => {
    render(<Host initialMaps={[{ id: 'a', name: 'Forest', gridSize: 50 }]} />);
    fire({ command: 'settings_map', result, data });
    expect(screen.getByTestId('map-a')).toHaveTextContent(shown);
  });

  it('still adds and removes maps', () => {
    render(<Host initialMaps={[{ id: 'a', name: 'Forest' }]} />);
    fire({ command: 'map_add', result: 'Ok', data: { id: 'b', name: 'Cave' } });
    fire({ command: 'map_remove', result: 'Ok', data: 'a' });
    expect(screen.queryByTestId('map-a')).not.toBeInTheDocument();
    expect(screen.getByTestId('map-b')).toHaveTextContent('Cave');
  });

});
