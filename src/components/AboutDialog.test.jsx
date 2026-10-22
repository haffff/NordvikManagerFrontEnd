import * as React from 'react';
import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '../setupTests';
import { AboutDialog } from './AboutDialog';

// The About window carries the attribution the AGPL's additional terms (section 7(b)) require
// to stay in the UI, the license, and where the source is (section 13: users over a network get
// the source of the version they use).
describe('AboutDialog', () => {
  const open = () => {
    const openRef = { current: null };
    renderWithProviders(<AboutDialog openRef={openRef} />);
    act(() => openRef.current());
  };

  it('shows the attribution with a link to the project', async () => {
    open();
    expect(await screen.findByText(/Powered by/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'NordvikManager' });
    expect(link).toHaveAttribute('href', 'https://nordvikmanager.pl');
  });

  it('names the license and links to the source', async () => {
    open();
    expect(await screen.findByText(/GNU Affero General Public License v3/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /source code/i })).toHaveAttribute('href', 'https://github.com/haffff/NordvikManager');
  });
});
