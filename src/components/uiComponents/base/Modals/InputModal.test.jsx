import React from 'react';
import { screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../../../setupTests';
import { InputModal } from './InputModal';

// Save used isDisabled, which this Chakra version ignores (it's `disabled`), so the
// button looked usable while the form was invalid.
describe('InputModal', () => {
  it('Save is disabled while a required field is empty', async () => {
    const openRef = React.createRef();
    renderWithProviders(
      <InputModal
        title="Edit folder"
        openRef={openRef}
        onCloseModal={vi.fn()}
        getConfigDict={() => [{ key: 'name', label: 'Folder Name', type: 'string', required: true }]}
      />
    );

    act(() => openRef.current({ name: 'Maps' }));
    const save = await screen.findByRole('button', { name: 'Save' });
    expect(save.disabled).toBe(false);

    await userEvent.clear(screen.getByDisplayValue('Maps'));
    await userEvent.tab(); // fields validate on leave

    expect(screen.getByRole('button', { name: 'Save' }).disabled).toBe(true);
  });
});
