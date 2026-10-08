import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../../../../setupTests';

vi.mock('../../../../../helpers/CommandExecutionHelper', () => ({
  default: { GetArgCompletions: vi.fn(() => Promise.resolve([])) },
}));

import { StepField } from './StepField';

// Get Data's Type was free text, and the help suggested names ('Map') that didn't match
// anything; the backend now marks it 'entitytype' and the editor offers the choices.
describe('StepField entitytype', () => {
  it('offers the entity types to pick from', () => {
    renderWithProviders(
      <StepField arg={{ name: 'Type', type: 'entitytype' }} value="" onChange={vi.fn()} variables={[]} knownNames={[]} />
    );

    fireEvent.focus(screen.getByRole('textbox'));

    for (const label of ['Map', 'Card', 'Layout', 'Action', 'Element', 'Property']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
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
