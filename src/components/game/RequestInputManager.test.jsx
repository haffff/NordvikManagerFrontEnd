import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../setupTests';

let deliver;
vi.mock('../uiComponents/base/Subscribable', () => ({ default: ({ onMessage }) => { deliver = onMessage; return null; } }));
vi.mock('../../ClientMediator', () => ({ default: { register: vi.fn(), unregister: vi.fn() } }));
const send = vi.fn();
vi.mock('../../helpers/transport', () => ({ ActiveTransportManager: { Send: (...a) => send(...a) } }));

import { RequestInputManager } from './RequestInputManager';

// A question with Options (RequestUserInput) is answered with a button, not typed.
describe('RequestInputManager options', () => {
  it('shows the options as buttons and answers with the one clicked', async () => {
    renderWithProviders(<RequestInputManager />);
    await act(async () => deliver({ inputToken: 't1', data: { message: 'Apply it?', showDialog: true, options: ['yes', 'half', 'no'] } }));

    expect(screen.queryByPlaceholderText('Type your answer')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'half' }));

    expect(send).toHaveBeenCalledWith({ command: 'input_value', inputToken: 't1', data: 'half' });
  });
});
