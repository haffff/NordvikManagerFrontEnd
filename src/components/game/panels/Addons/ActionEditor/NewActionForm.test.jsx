import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../../../../setupTests';
import { NewActionForm } from './NewActionForm';
import { ACTION_TEMPLATES } from './actionTemplates';

// A new action starts empty or from a template.
describe('NewActionForm', () => {
  it('creates from the template picked', () => {
    const onCreate = vi.fn();
    renderWithProviders(<NewActionForm onCreate={onCreate} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Start from'), { target: { value: 'area' } });
    fireEvent.change(screen.getByPlaceholderText('action name'), { target: { value: 'fireball' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onCreate).toHaveBeenCalledWith('', 'fireball', ACTION_TEMPLATES.find((t) => t.key === 'area'));
  });

  it('creates an empty action by default', () => {
    const onCreate = vi.fn();
    renderWithProviders(<NewActionForm onCreate={onCreate} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('action name'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onCreate).toHaveBeenCalledWith('', 'x', null);
  });
});
