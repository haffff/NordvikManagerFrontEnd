import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../../setupTests';

vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: { getAsync: vi.fn(), get: vi.fn() },
  ActiveTransportManager: { Subscribe: vi.fn(), Unsubscribe: vi.fn(), Send: vi.fn() },
}));

import { EditTable } from './EditTable';

// Invalid fields were never marked: Chakra 3 ignores `isInvalid` (Input/Textarea use
// aria-invalid, NumberInput `invalid`). And once marked, a field stayed marked after
// being fixed, since errors were never cleared.
describe('EditTable validation marking', () => {
  const mustBeAbc = { validate: (v) => ({ success: v === 'abc', message: 'Must be abc' }) };

  it('marks an invalid text field, and unmarks it once fixed', () => {
    renderWithProviders(
      <EditTable
        dto={{ name: 'start' }}
        editableKeyLabelDict={[{ key: 'name', label: 'Name', type: 'string', ...mustBeAbc }]}
        onSave={vi.fn()}
        saveOnLeave
      />
    );
    const input = screen.getByDisplayValue('start');

    fireEvent.change(input, { target: { value: 'nope' } });
    expect(input.getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(input, { target: { value: 'abc' } });
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
  });

  it('marks an invalid number field', () => {
    renderWithProviders(
      <EditTable
        dto={{ size: 5 }}
        editableKeyLabelDict={[{ key: 'size', label: 'Size', type: 'number', validate: () => ({ success: false, message: 'no' }) }]}
        onSave={vi.fn()}
        saveOnLeave
      />
    );
    const input = screen.getByRole('spinbutton');

    fireEvent.change(input, { target: { value: '7' } });

    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
});
