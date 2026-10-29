import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../setupTests';
import UiModeSettings from './UiModeSettings';
import { getUiModeOverride, setActiveUiMode } from '../../../helpers/uiMode';

describe('UiModeSettings', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => setActiveUiMode('desktop'));

  it('shows the stored choice, Auto by default', () => {
    renderWithProviders(<UiModeSettings />);
    expect(screen.getByLabelText('Interface')).toHaveValue('auto');
  });

  it('stores the new choice and offers a reload when it changes the interface', () => {
    const reload = vi.fn();
    renderWithProviders(<UiModeSettings onReload={reload} />);
    expect(screen.queryByRole('button', { name: /reload/i })).toBeNull();

    fireEvent.change(screen.getByLabelText('Interface'), { target: { value: 'mobile' } });

    expect(getUiModeOverride()).toBe('mobile');
    fireEvent.click(screen.getByRole('button', { name: /reload/i }));
    expect(reload).toHaveBeenCalled();
  });

  it('no reload is offered when the choice matches the interface in use', () => {
    setActiveUiMode('mobile');
    renderWithProviders(<UiModeSettings onReload={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Interface'), { target: { value: 'mobile' } });
    expect(screen.queryByRole('button', { name: /reload/i })).toBeNull();
  });
});
