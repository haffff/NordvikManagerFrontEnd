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

  it('creates from pasted JSON, named by it unless a name is typed', () => {
    const onCreate = vi.fn();
    renderWithProviders(<NewActionForm onCreate={onCreate} onCancel={vi.fn()} stepTypes={['SendChat']} />);

    fireEvent.change(screen.getByLabelText('Start from'), { target: { value: 'json' } });
    fireEvent.change(screen.getByLabelText('Action JSON'), {
      target: { value: '{ "prefix": "me", "name": "greet", "hook": 3, "content": [{ "Type": "SendChat", "Data": {} }] }' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onCreate).toHaveBeenCalledWith('me', 'greet', {
      hook: 3, description: '', content: [{ Type: 'SendChat', Data: {} }],
    });
  });

  it('shows what is wrong with the JSON and creates nothing', () => {
    const onCreate = vi.fn();
    renderWithProviders(<NewActionForm onCreate={onCreate} onCancel={vi.fn()} stepTypes={['SendChat']} />);

    fireEvent.change(screen.getByLabelText('Start from'), { target: { value: 'json' } });
    fireEvent.change(screen.getByLabelText('Action JSON'), {
      target: { value: '{ "name": "x", "content": [{ "Type": "DealDamage", "Data": {} }] }' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByText(/No such step: DealDamage/)).toBeInTheDocument();
  });
});
