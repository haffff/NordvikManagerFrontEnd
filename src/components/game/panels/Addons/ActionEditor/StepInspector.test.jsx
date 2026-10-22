import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../../../../setupTests';

vi.mock('../../../../../helpers/CommandExecutionHelper', () => ({ default: { GetArgCompletions: vi.fn(() => Promise.resolve([])) } }));

import { StepInspector } from './StepInspector';

// Clicking a variable in the inspector's list puts its token into the field last edited.
describe('StepInspector variables', () => {
  const def = { value: 'SendChat', name: 'Send Chat', category: 'Chat', arguments: [{ name: 'Title' }, { name: 'Message' }] };
  const variables = [{ name: 'card', source: 'step', kind: 'object', fields: ['name'] }];

  it('inserts into the field being edited', () => {
    const onChangeData = vi.fn();
    renderWithProviders(
      <StepInspector step={{ id: 's', Type: 'SendChat', Data: { Message: 'Hi ' } }} index="1" def={def} stepDefinitions={[def]}
        variables={variables} knownNames={new Set(['card'])} actionOptions={[]} trace={null}
        onChangeType={vi.fn()} onChangeData={onChangeData} onFieldBlur={vi.fn()} />
    );

    const [, message] = screen.getAllByRole('textbox');
    fireEvent.focus(message);
    fireEvent.click(screen.getByRole('button', { name: '%card.name%' }));

    expect(onChangeData).toHaveBeenLastCalledWith('Message', 'Hi %card.name%');
  });
});
