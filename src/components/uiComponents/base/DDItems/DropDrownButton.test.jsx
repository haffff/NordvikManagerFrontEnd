import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../setupTests';
import { PermissionsProvider } from '../../../../contexts/PermissionsContext';
import { PERM } from '../../../BattleMap/Helpers/permissionBits';
import { DropDownButton } from './DropDrownButton';

const renderAs = (gamePermission, isOwner = false) =>
  renderWithProviders(
    <PermissionsProvider gameId="g1" isOwner={isOwner} gamePermission={gamePermission}>
      <DropDownButton name="Addons" requiresEdit />
    </PermissionsProvider>
  );

// Menus that change the game follow the game's Edit permission, not who owns it.
describe('DropDownButton requiresEdit', () => {
  it('is shown to a player with Edit on the game', () => {
    renderAs(PERM.SEE | PERM.EDIT);
    expect(screen.queryByText('Addons')).not.toBeNull();
  });

  it('is hidden from a player who can only see the game', () => {
    renderAs(PERM.SEE);
    expect(screen.queryByText('Addons')).toBeNull();
  });

  it('is shown to the owner', () => {
    renderAs(PERM.NONE, true);
    expect(screen.queryByText('Addons')).not.toBeNull();
  });
});
