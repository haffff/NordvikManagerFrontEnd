import CommandFactory from "../Factories/CommandFactory";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";

// Shared between TokenQuickEditOverlay.js and TokenIconPickerOverlay.js — both
// read/write arbitrary addon-declared properties scoped to a token's own card
// or element, using the same propDep-style "source" convention TokenManager's
// own _resolveParentId/_applyDep already use (p.entityName.toLowerCase()
// .startsWith(source)). Only "card" and "element" are supported — a field
// scoped to the whole map/game isn't a case either overlay needs to cover.
export const ENTITY_NAME_BY_SOURCE = { card: "CardModel", element: "ElementModel" };

export function resolveTokenParentId(source, token) {
  if (source === "element") return token.id;
  if (source === "card") return token.tokenData?.cardId;
  return undefined;
}

/**
 * Writes a single property scoped to a token's card/element, creating it if
 * no existing property id is known yet, otherwise updating it in place —
 * mirrors PropertiesSettingsPanel.js's own add-vs-update split.
 */
export function writeTokenProperty({ token, source, dtoProperty, value, existingId }) {
  const parentId = resolveTokenParentId(source, token);
  if (!parentId) return;
  const entityName = ENTITY_NAME_BY_SOURCE[source];

  if (existingId) {
    WebSocketManagerInstance.Send(
      CommandFactory.CreatePropertyUpdateCommand({ id: existingId, name: dtoProperty, value, entityName, parentId })
    );
  } else {
    WebSocketManagerInstance.Send(
      CommandFactory.CreatePropertyAddCommand({ name: dtoProperty, value, isProtected: false, entityName, parentId })
    );
  }
}
