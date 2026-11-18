import { describe, it, expect } from 'vitest';
import { screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../setupTests';
import { ImportCodePrompt, askImportCode } from './ImportCodePrompt';

// Before code from another server is imported, the GM sees which cards bring it and decides.

const inspection = {
  kind: 'map', name: 'Dungeon', fromThisServer: false, needsConfirmation: true,
  code: [{ card: 'Goblin', files: ['goblin.html', 'goblin.js'] }, { card: 'Orc', files: ['orc.html'] }],
};

describe('ImportCodePrompt', () => {
  it('declines when no prompt is mounted', async () => {
    expect(await askImportCode(inspection)).toBe(false);
  });

  it('lists the cards and their code, and answers what the GM chose', async () => {
    renderWithProviders(<ImportCodePrompt />);

    let answer;
    act(() => { answer = askImportCode(inspection); });
    expect(await screen.findByText('Import code from another server?')).toBeTruthy();
    expect(screen.getByText(/"Dungeon" wasn't exported by this server/)).toBeTruthy();
    expect(screen.getByText('Goblin')).toBeTruthy();
    expect(screen.getByText(/goblin\.html, goblin\.js/)).toBeTruthy();
    expect(screen.getByText(/orc\.html/)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Import anyway' }));
    expect(await answer).toBe(true);

    act(() => { answer = askImportCode(inspection); });
    await userEvent.click(await screen.findByRole('button', { name: "Don't import" }));
    expect(await answer).toBe(false);
  });
});
