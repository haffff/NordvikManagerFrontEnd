import React from 'react';
import { screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../../../../setupTests';
import { StepList } from './StepList';

// The step's Duplicate/Delete buttons are shown on hover via Chakra's _groupHover, which
// in Chakra 3 needs a parent with class "group" (Chakra 2 used role="group"). The row
// only had role="group", so the buttons stayed invisible and steps couldn't be deleted.
describe('StepList', () => {
  it('the row is a hover group for its step buttons', () => {
    renderWithProviders(
      <StepList
        steps={[{ id: 's1', Type: 'GetData', Data: {} }]}
        defsByType={{ GetData: { value: 'GetData', name: 'Get Data', category: 'Data', arguments: [], summary: 'Get {Type}' } }}
        selectedId={null}
        traceFor={() => null}
        onSelect={vi.fn()} onMove={vi.fn()} onInsert={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()} onOpenAction={vi.fn()}
      />
    );

    for (const name of ['Delete step', 'Duplicate step']) {
      expect(screen.getByRole('button', { name }).closest('.group')).not.toBeNull();
    }
  });

  // If's Then / Else and ForEach's Do are shown under their step, each with its own list.
  const defs = {
    If: { value: 'If', name: 'If', category: 'Control Flow', summary: 'If {Condition}',
      arguments: [{ name: 'Condition' }, { name: 'Then', type: 'steps' }, { name: 'Else', type: 'steps' }] },
    Log: { value: 'Log', name: 'Log', category: 'Utility', summary: 'Log {Message}', arguments: [{ name: 'Message' }] },
  };
  const ifWithThen = [{ id: 'if', Type: 'If', Data: { Condition: '1 = 1', Then: [{ id: 'in', Type: 'Log', Data: { Message: 'inside' } }] } }];
  const renderTree = (props = {}) => renderWithProviders(
    <StepList steps={ifWithThen} defsByType={defs} selectedId={null} traceFor={() => null}
      onSelect={vi.fn()} onMove={vi.fn()} onInsert={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()} onOpenAction={vi.fn()} {...props} />
  );

  it('shows the steps of a block under their step', () => {
    renderTree();

    const then = screen.getByTestId('block-if-Then');
    expect(within(then).getByText('inside')).toBeInTheDocument();
    expect(screen.getByTestId('block-if-Else')).toBeInTheDocument(); // empty, still offered
  });

  it('adds a step into a block', () => {
    const onInsert = vi.fn();
    renderTree({ onInsert });

    fireEvent.click(within(screen.getByTestId('block-if-Else')).getByText('Add step'));

    expect(onInsert).toHaveBeenCalledWith({ parentId: 'if', block: 'Else' }, 0);
  });

  it('selects a step inside a block', () => {
    const onSelect = vi.fn();
    renderTree({ onSelect });

    fireEvent.click(screen.getByText('inside'));

    expect(onSelect).toHaveBeenCalledWith('in');
  });

  // Under a step: what its output variable will hold, before anything runs.
  it('shows what a step gives back', () => {
    renderWithProviders(
      <StepList steps={[{ id: 'f', Type: 'Log', Data: {} }]} defsByType={defs} selectedId={null} traceFor={() => null}
        outputsFor={() => [{ name: 'targets', kind: 'list', fields: ['id', 'name'] }, { name: 'roll', kind: 'value', fields: [] }]}
        onSelect={vi.fn()} onMove={vi.fn()} onInsert={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()} onOpenAction={vi.fn()} />
    );

    expect(screen.getByText('targets')).toBeInTheDocument();
    expect(screen.getByText(/list of: id, name/)).toBeInTheDocument();
    expect(screen.getByText('roll')).toBeInTheDocument();
  });
});
