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
  it.each([
    ['shown to a player with Edit on the game', PERM.SEE | PERM.EDIT, false, true],
    ['hidden from a player who can only see the game', PERM.SEE, false, false],
    ['shown to the owner', PERM.NONE, true, true],
  ])('is %s', (_name, gamePermission, isOwner, shown) => {
    renderAs(gamePermission, isOwner);
    expect(screen.queryByText('Addons') !== null).toBe(shown);
  });

});
