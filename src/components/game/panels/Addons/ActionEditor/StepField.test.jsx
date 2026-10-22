import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../../../../setupTests';

vi.mock('../../../../../helpers/CommandExecutionHelper', () => ({
  default: { GetArgCompletions: vi.fn(() => Promise.resolve([])) },
}));

import { StepField } from './StepField';

// Find's What and the property steps' Of take one of a few words; the editor offers them.
describe('StepField findkind and propertyowner', () => {
  it('offers what Find can find', () => {
    renderWithProviders(
      <StepField arg={{ name: 'What', type: 'findkind' }} value="" onChange={vi.fn()} variables={[]} knownNames={[]} />
    );

    fireEvent.focus(screen.getByRole('textbox'));

    for (const label of ['Tokens', 'Cards', 'Maps', 'Players']) {
      expect(screen.getByText(new RegExp(`^${label}`))).toBeInTheDocument();
    }
  });

  it("offers whose property: a token's card, the map, the game", () => {
    renderWithProviders(
      <StepField arg={{ name: 'Of', type: 'propertyowner' }} value="" onChange={vi.fn()} variables={[]} knownNames={[]} />
    );

    fireEvent.focus(screen.getByRole('textbox'));

    expect(screen.getByText(/card of the token/)).toBeInTheDocument();
    expect(screen.getByText(/^The map/)).toBeInTheDocument();
    expect(screen.getByText(/^The game/)).toBeInTheDocument();
  });
});

// Add Menu Item's Location was free text with no hint which menu ids exist; the backend
// marks it 'menulocation' and the editor offers the app's menus.
describe('StepField menulocation', () => {
  it('offers the built-in menus, labelled', () => {
    renderWithProviders(
      <StepField arg={{ name: 'Location', type: 'menulocation' }} value="" onChange={vi.fn()} variables={[]} knownNames={[]} />
    );

    fireEvent.focus(screen.getByRole('textbox'));

    expect(screen.getByText(/Map right-click → Add/)).toBeInTheDocument();
    expect(screen.getByText(/Game menu/)).toBeInTheDocument();
  });
});

// Shape and SnapToGrid were free text; each shape step lists only the shapes it takes.
describe('StepField shapes and grid snap', () => {
  const offered = (type) => {
    renderWithProviders(
      <StepField arg={{ name: 'Shape', type }} value="" onChange={vi.fn()} variables={[]} knownNames={[]} />
    );
    fireEvent.focus(screen.getByRole('textbox'));
  };

  it("offers Find's area shapes, without text or none", () => {
    offered('areashape');
    for (const v of ['circle', 'rect', 'line', 'cone']) expect(screen.getByText(new RegExp(`· ${v}$`))).toBeInTheDocument();
    expect(screen.queryByText(/· text$/)).not.toBeInTheDocument();
  });

  it('offers text for markers and elements', () => {
    offered('markershape');
    expect(screen.getByText(/· text$/)).toBeInTheDocument();
    expect(screen.queryByText(/· none$/)).not.toBeInTheDocument();
  });

  it('offers text and none for Request Point', () => {
    offered('pointshape');
    expect(screen.getByText(/· text$/)).toBeInTheDocument();
    expect(screen.getByText(/· none$/)).toBeInTheDocument();
  });

  it('offers the grid snaps', () => {
    offered('gridsnap');
    for (const v of ['none', 'center', 'corner']) expect(screen.getByText(new RegExp(`· ${v}$`))).toBeInTheDocument();
  });
});

// A switch that is on unless turned off (StopIfCancelled) shows as on when not set.
describe('StepField boolean default', () => {
  it('shows the default when the value is not set', () => {
    renderWithProviders(
      <StepField arg={{ name: 'StopIfCancelled', type: 'Boolean', default: true }} value={undefined} onChange={vi.fn()} variables={[]} knownNames={[]} />
    );

    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});
