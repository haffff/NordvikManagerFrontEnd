import React from 'react';
import { screen } from '@testing-library/react';
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
});
