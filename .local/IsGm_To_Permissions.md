
● User approved Claude's plan
  ⎿  Plan saved to: C:\Users\EPlikNew\.claude\plans\compressed-twirling-fern.md · /plan to edit        
     Plan: Migrate isGM to Permissions System

     Context

     The app currently gates features with a binary isGM flag derived from game.master.id ===
     player.id, stored in localStorage as gmMode and read via a gmOnly prop scattered across dropdown  
     components. There is no centralized permissions abstraction. Per-object permissions already exist 
     (bitwise integer per player ID, fetched from security/permissions), but are only used on canvas   
     elements. This plan centralizes the permissions model, fixes the control permission bug, adds     
     GM-driven permission assignment from the context menu, and adds visual feedback.

     Roles (all frontend-derived):
     - ADMIN — running in GM server mode (REACT_APP_MODE !== 'player')
     - GM — player whose ID matches game.master.id (within a session)
     - PLAYER — everyone else

     ---
     Part 1 — Centralized Permissions Context

     1.1 Create PermissionsContext

     New file: src/contexts/PermissionsContext.js

     export const ROLES = { ADMIN: 'admin', GM: 'gm', PLAYER: 'player' };

     // Derives current role and exposes helpers
     // - currentRole: ROLES enum value
     // - isAdmin, isGM, isPlayer: boolean shortcuts
     // - hasRole(role): true if currentRole >= role in hierarchy ADMIN > GM > PLAYER
     // - getObjectPermission(permissionBits): { canSee, canControl, canEdit, canAll }

     Role derivation:
     - ADMIN if process.env.REACT_APP_MODE !== 'player'
     - GM if currentPlayer.id === game.master.id
     - PLAYER otherwise

     Wire into Game.js after useGameInitialization resolves, wrapping children with
     <PermissionsProvider>.

     Critical files:
     - src/components/game/Game.js — wrap game content with provider
     - src/components/game/hooks/useGameInitialization.js:52 — localStorage.setItem('gmMode', ...) can 
     be removed after migration
     - src/components/game/hooks/useGameApi.js — expose GetRole() and GetIsGM() via ClientMediator for 
     non-React consumers

     1.2 Register role in ClientMediator

     In useGameApi.js, add:
     - GetRole: () => derivedRole
     - GetIsGM: () => currentPlayer.id === gameRef.current?.master?.id

     So that non-React code (BattleMap behaviors) can still query role without React hooks.

     ---
     Part 2 — UI Permission Blocker

     2.1 Create PermissionGate component

     New file: src/components/uiComponents/base/PermissionGate.js

     Props: role (required minimum role), showLocked (default false), tooltip

     - If user has role: render children
     - If showLocked=true: render a disabled wrapper + lock icon + Chakra tooltip ("Admin only" / "GM  
     only")
     - If showLocked=false: render nothing

     2.2 Migrate gmOnly infrastructure

     Replace localStorage.getItem("gmMode") !== "true" checks with usePermissions().isGM (or
     hasRole(ROLES.GM)):

     ┌────────────────────────────────────────────────────────────────────┬──────┬───────────────────┐ 
     │                                File                                │ Line │      Change       │ 
     │                                                                    │  s   │                   │ 
     ├────────────────────────────────────────────────────────────────────┼──────┼───────────────────┤ 
     │                                                                    │      │ Read from         │ 
     │ src/components/uiComponents/base/DDItems/DropDownItem.js           │ 5–8  │ usePermissions    │ 
     │                                                                    │      │ hook              │ 
     ├────────────────────────────────────────────────────────────────────┼──────┼───────────────────┤ 
     │ src/components/uiComponents/base/DDItems/DropDrownButton.js        │ 14–1 │ Same              │ 
     │                                                                    │ 6    │                   │ 
     ├────────────────────────────────────────────────────────────────────┼──────┼───────────────────┤ 
     │ src/components/uiComponents/base/DDItems/DropDownMenu.js           │ 42–4 │ Same              │ 
     │                                                                    │ 4    │                   │ 
     ├────────────────────────────────────────────────────────────────────┼──────┼───────────────────┤ 
     │ src/components/uiComponents/base/DDItems/SpecialButtons/CreateDrop │ 7–15 │ Same              │ 
     │ DownButton.js                                                      │      │                   │ 
     ├────────────────────────────────────────────────────────────────────┼──────┼───────────────────┤ 
     │                                                                    │      │ Replace async     │ 
     │ src/components/uiComponents/base/OnlyOwner.js                      │ 5–21 │ ClientMediator    │ 
     │                                                                    │      │ call with usePerm │ 
     │                                                                    │      │ issions().isGM    │ 
     └────────────────────────────────────────────────────────────────────┴──────┴───────────────────┘ 

     Keep the gmOnly prop as the external API — just change the underlying check.

     2.3 Add adminOnly prop

     Extend the same gmOnly prop pattern with an adminOnly prop that checks isAdmin. Existing usages   
     are unaffected.

     ---
     Part 3 — Object-Level Permission Checks

     3.1 Centralize permission bit decoding

     New file: src/components/BattleMap/helpers/permissionBits.js

     export const PERM = { NONE: 0, SEE: 1, CONTROL: 4, EDIT: 7, ALL: 31 };
     export const canSee     = (bits) => (bits & 1) === 1;
     export const canControl = (bits) => (bits & 4) === 4;
     export const canEdit    = (bits) => (bits & 7) === 7;

     Replace inline (permission & 4) == 4 expressions across:
     - src/components/BattleMap/DTOConverter.js:44
     - src/components/BattleMap/Behaviors/Server/OnPermissionsChangedBehavior.js:25–30
     - src/components/BattleMap/Behaviors/Server/OnAddElementBehavior.js:19–21
     - src/components/BattleMap/Behaviors/Server/OnGroupBehavior.js:18
     - src/components/BattleMap/Managers/BMService.js:235–240

     3.2 GM always has full permissions

     In OnPermissionsChangedBehavior.js and DTOConverter.js, if isGM (via
     ClientMediator.sendCommand('Game', 'GetIsGM')), override permission bits to PERM.ALL so GM is     
     never locked out of their own elements.

     ---
     Part 4 — Fix Control Permission Bug

     4.1 Fix OnUpdateElementBehavior.js

     File: src/components/BattleMap/Behaviors/Server/OnUpdateElementBehavior.js:14–21

     Current logic skips updates for elements being moved by the current player (negation bug). Fix:   
     remove the update-skip entirely OR restructure so optimistic-update logic is correct. The update  
     should always be applied; the only exception was meant to avoid overwriting a drag-in-progress,   
     which should be handled differently (e.g., skip only if object is isBeingDragged).

     4.2 Fix OnGroupBehavior.js

     File: src/components/BattleMap/Behaviors/Server/OnGroupBehavior.js:31–35

     response.playerId === response.id compares two properties of the same response object (always true
      or always false depending on shape). Fix: compare against currentPlayer.id — response.playerId   
     === currentPlayer.id.

     ---
     Part 5 — UX: "Give Control" Context Menu & Visual Indicators

     5.1 "Give Control to Player" in BattleMapContextMenu

     File: src/components/game/ToolBar/ContextMenus/BattleMapContextMenu.js

     Add a gmOnly submenu "Permissions →" when a single object is selected (alongside existing
     Delete/Copy). Sub-menu structure:
     Permissions →
       Player 1 →    See | Control | Edit | None
       Player 2 →    See | Control | Edit | None
       Everyone →    See | Control | Edit | None

     On selection: call WebHelper.postAsync('security/permissions', { entityId, entityType, playerId,  
     permission: bits }) (use ActiveWebHelper from transport.js).

     Players list comes from ClientMediator.sendCommand('Game', 'GetPlayers').

     5.2 Visual indicator for player-controlled elements

     File: src/components/BattleMap/Behaviors/Server/OnPermissionsChangedBehavior.js

     After applying permission bits, if any player (other than GM) has canControl permission, add a    
     colored border to the canvas object using that player's color (player.color). Clear the border    
     when permissions are revoked. Player colors are available via ClientMediator.sendCommand('Game',  
     'GetPlayers').

     ---
     Verification

     1. Roles: Launch as player and GM, confirm currentRole is correct in both modes via React DevTools
      or console
     2. UI gating: Verify GM-only toolbar items disappear for players; lock icons appear where
     showLocked=true
     3. Bug fix: As a player, move an element — confirm it updates smoothly without freezing
     4. Give control: GM right-clicks element → Permissions → selects player + permission level →      
     player can now select the element; player cannot select elements they have no permission on       
     5. Visual indicator: Confirm colored border appears on elements when a player is granted control  
     and disappears when revoked
     6. Admin role: Confirm admin-gated items are hidden in player mode (REACT_APP_MODE=player)   