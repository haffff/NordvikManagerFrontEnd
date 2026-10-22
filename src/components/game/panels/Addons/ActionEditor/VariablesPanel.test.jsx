import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../../../../setupTests';
import { VariablesPanel } from './VariablesPanel';

// The variables a step can use, with their fields; a click puts the token in the field
// being edited, so nobody has to remember %name.path% syntax.
describe('VariablesPanel', () => {
  const variables = [
    { name: 'playerName', source: 'builtin', kind: 'value', fields: [] },
    { name: 'targets', source: 'step', kind: 'list', fields: ['id', 'name'] },
    { name: 'card', source: 'step', kind: 'object', fields: ['name'] },
  ];

  it('inserts a variable, a field of an object, and a field of a list item', () => {
    const onInsert = vi.fn();
    renderWithProviders(<VariablesPanel variables={variables} values={null} onInsert={onInsert} />);

    fireEvent.click(screen.getByText('playerName'));
    fireEvent.click(screen.getByRole('button', { name: '%card.name%' }));
    fireEvent.click(screen.getByRole('button', { name: '%targets[0].id%' }));

    expect(onInsert.mock.calls.map((c) => c[0])).toEqual(['%playerName%', '%card.name%', '%targets[0].id%']);
  });

  it('shows the values of the last run next to them', () => {
    renderWithProviders(
      <VariablesPanel variables={variables} values={{ playerName: 'Wizard', card: { name: 'Goblin' }, targets: [{ id: 'a' }, { id: 'b' }] }} onInsert={vi.fn()} />
    );

    expect(screen.getByText('Wizard')).toBeInTheDocument();
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('2 items')).toBeInTheDocument();
  });
});
