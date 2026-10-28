import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../../../../setupTests';

vi.mock('../../../../../helpers/CommandExecutionHelper', () => ({ default: { GetArgCompletions: vi.fn(() => Promise.resolve([])) } }));

import { StepInspector, isArgVisible } from './StepInspector';

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

// Shape-dependent arguments (Radius, Width, Height, Angle, Toward…) only show for the shapes
// they apply to; an empty Shape counts as its default (circle).
describe('isArgVisible', () => {
  const shape = { name: 'Shape', default: 'circle' };
  const args = [shape];
  const height = { name: 'Height', conditionField: 'Shape', conditionValue: 'rect' };
  const width = { name: 'Width', conditionField: 'Shape', conditionValue: 'rect|line' };
  const radius = { name: 'Radius', conditionField: 'Shape', conditionValue: 'circle|line|cone' };

  it('shows an argument for any of the values it lists', () => {
    expect(isArgVisible(width, { Shape: 'line' }, args)).toBe(true);
    expect(isArgVisible(width, { Shape: 'Rect' }, args)).toBe(true);
    expect(isArgVisible(width, { Shape: 'cone' }, args)).toBe(false);
  });

  it('an empty controlling field counts as its default', () => {
    expect(isArgVisible(radius, {}, args)).toBe(true);
    expect(isArgVisible(height, { Shape: '' }, args)).toBe(false);
  });

  it('a token in the controlling field could be anything: show it', () => {
    expect(isArgVisible(height, { Shape: '%shape%' }, args)).toBe(true);
  });

  it('booleans as before', () => {
    const title = { name: 'ChatTitle', conditionField: 'PrintToChat', conditionValue: 'true' };
    expect(isArgVisible(title, { PrintToChat: true }, [])).toBe(true);
    expect(isArgVisible(title, { PrintToChat: false }, [])).toBe(false);
  });
});
