import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '../../../../../setupTests';

vi.mock('../../../../../helpers/transport', () => ({ ActiveWebHelper: { postAsync: vi.fn() } }));

import { ActiveWebHelper } from '../../../../../helpers/transport';
import { QueryResolver } from './QueryResolver';

const renderOpen = () => {
  renderWithProviders(<QueryResolver />);
  fireEvent.click(screen.getByText('Query Resolver'));
};

describe('QueryResolver', () => {
  beforeEach(() => vi.clearAllMocks());

  it('suggests the %q:type[name].prop% form', () => {
    renderOpen();

    expect(screen.getByPlaceholderText(/%q:card\[Goblin\]\.hp%/)).toBeTruthy();
  });

  it('shows the result and the tokens that found nothing', async () => {
    ActiveWebHelper.postAsync.mockResolvedValue({
      status: 200,
      body: { result: '7 / ', unresolved: ['%q:card[Nobody].hp%'] },
    });
    renderOpen();

    fireEvent.change(screen.getByPlaceholderText(/%q:card/), { target: { value: '%q:card[Goblin].hp% / %q:card[Nobody].hp%' } });
    fireEvent.click(screen.getByRole('button', { name: /Resolve/ }));

    expect(await screen.findByText('7 /')).toBeTruthy();
    expect(screen.getByText(/Not found: %q:card\[Nobody\]\.hp%/)).toBeTruthy();
  });
});
