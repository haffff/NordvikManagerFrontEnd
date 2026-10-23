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

  it('a rename (settings_map) shows in the list', () => {
    render(<Host initialMaps={[{ id: 'a', name: 'Forest', gridSize: 50 }]} />);
    fire({ command: 'settings_map', result: 'Ok', data: { id: 'a', name: 'Dark Forest' } });
    expect(screen.getByTestId('map-a')).toHaveTextContent('Dark Forest|50');
  });

  it('a partial settings_map (grid edit) keeps the name', () => {
    render(<Host initialMaps={[{ id: 'a', name: 'Forest', gridSize: 50 }]} />);
    fire({ command: 'settings_map', result: 'Ok', data: { id: 'a', gridSize: 70, action: 'gridEdit' } });
    expect(screen.getByTestId('map-a')).toHaveTextContent('Forest|70');
  });

  it('still adds and removes maps', () => {
    render(<Host initialMaps={[{ id: 'a', name: 'Forest' }]} />);
    fire({ command: 'map_add', result: 'Ok', data: { id: 'b', name: 'Cave' } });
    fire({ command: 'map_remove', result: 'Ok', data: 'a' });
    expect(screen.queryByTestId('map-a')).not.toBeInTheDocument();
    expect(screen.getByTestId('map-b')).toHaveTextContent('Cave');
  });

  it('ignores a refused rename', () => {
    render(<Host initialMaps={[{ id: 'a', name: 'Forest' }]} />);
    fire({ command: 'settings_map', result: 'NoPermission', data: { id: 'a', name: 'Hacked' } });
    expect(screen.getByTestId('map-a')).toHaveTextContent('Forest');
  });
});
