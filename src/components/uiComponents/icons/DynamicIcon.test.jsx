import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../../setupTests';

// DynamicIcon (folder icons in the tree, among others) built its import path at
// runtime, import(`react-icons/${pack}`), which Vite can't bundle: in the browser the
// import failed and no icon showed. It must load packs through the shared static
// table in ReactIconPackLoaders, like TokenManager does.
vi.mock('../../../helpers/ReactIconPackLoaders', () => ({
  ICON_PACK_LOADERS: {
    gi: () => Promise.resolve({ GiTestIcon: (props) => <svg data-testid="gi-test" {...props} /> }),
  },
}));

import { DynamicIcon } from './DynamicIcon';

describe('DynamicIcon', () => {
  it('loads the icon through the static pack table', async () => {
    renderWithProviders(<DynamicIcon iconName="GiTestIcon" iconProps={{ size: 20 }} />);

    await waitFor(() => expect(screen.getByTestId('gi-test')).toBeTruthy());
    expect(screen.getByTestId('gi-test').getAttribute('size')).toBe('20');
  });

  it('an unknown pack or icon renders nothing', async () => {
    const { container } = renderWithProviders(
      <>
        <DynamicIcon iconName="GiTestIcon" iconPack="nope" />
        <DynamicIcon iconName="GiMissing" />
      </>
    );

    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector('svg')).toBeNull();
  });
});
