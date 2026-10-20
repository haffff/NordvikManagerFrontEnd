import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { PermissionsProvider, usePermissions } from './PermissionsContext';
import { PERM, ENTITY_TYPES } from '../components/BattleMap/Helpers/permissionBits';

const GAME_ID = 'game-1';

const render = (props) =>
  renderHook(() => usePermissions(), {
    wrapper: ({ children }) => (
      <PermissionsProvider gameId={GAME_ID} isOwner={false} isLocalAdmin={false} gamePermission={PERM.NONE} {...props}>
        {children}
      </PermissionsProvider>
    ),
  }).result.current;

// The UI follows what the server lets the player do: editing the game is the game's Edit
// permission, the owner only decides who the GM is, the host's disk is the local admin's.
describe('PermissionsContext', () => {
  it('a player with Edit on the game can edit it without being the owner', () => {
    const perms = render({ gamePermission: PERM.SEE | PERM.EDIT });

    expect(perms.canEditGame).toBe(true);
    expect(perms.isOwner).toBe(false);
  });

  it('a reader cannot edit the game', () => {
    expect(render({ gamePermission: PERM.SEE }).canEditGame).toBe(false);
  });

  it('the owner can always edit the game', () => {
    expect(render({ isOwner: true }).canEditGame).toBe(true);
  });

  it('the build (GM server app) grants nothing by itself', () => {
    const perms = render({});

    expect(perms.canEditGame).toBe(false);
    expect(perms.hasEntityPermission(ENTITY_TYPES.MAP, 'map-1', PERM.EDIT)).toBe(false);
  });

  it('passes the local admin flag through', () => {
    expect(render({ isLocalAdmin: true }).isLocalAdmin).toBe(true);
    expect(render({}).isLocalAdmin).toBe(false);
  });

  it('the game entity check uses the game permission it was given', () => {
    const perms = render({ gamePermission: PERM.SEE | PERM.EDIT });

    expect(perms.hasEntityPermission(ENTITY_TYPES.GAME, GAME_ID, PERM.EDIT)).toBe(true);
    expect(perms.getEntityPermission(ENTITY_TYPES.GAME, GAME_ID)).toBe(PERM.SEE | PERM.EDIT);
  });
});
