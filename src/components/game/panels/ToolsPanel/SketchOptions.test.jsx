import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../setupTests';

const { me } = vi.hoisted(() => ({ me: { id: 'p1' } }));
vi.mock('../../../../ClientMediator', () => ({
  default: {
    sendCommand: vi.fn((panel, command) => {
      if (command === 'GetIsGM') return true; // the owner and co-GMs alike
      if (command === 'GetOwner') return 'owner';
      if (command === 'GetCurrentPlayer') return me;
      return undefined;
    }),
  },
}));

import { SketchOptions } from './SketchOptions';

// Other players' screens accept "clear everyone's" only from the owner, so only the owner
// gets the button (co-GMs are GMs everywhere else).
describe("SketchOptions — Clear everyone's", () => {
  beforeEach(() => { me.id = 'p1'; });

  it('is shown to the owner', () => {
    me.id = 'owner';
    renderWithProviders(<SketchOptions battleMapId="bm" />);
    expect(screen.queryByLabelText("Clear everyone's")).not.toBeNull();
  });

  it('is not shown to a co-GM', () => {
    renderWithProviders(<SketchOptions battleMapId="bm" />);
    expect(screen.queryByLabelText("Clear everyone's")).toBeNull();
  });
});
