import CommandFactory from "../Factories/CommandFactory";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import ClientMediator from "../../../ClientMediator";

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
 * Writes a single property scoped to a token's card/element: updates it in place when
 * its id is known, otherwise looks it up by name first — it may have been created
 * since the caller read it (an icon toggled on, then off again: the server refuses a
 * second add) — and only adds it when it really doesn't exist yet.
 * Resolves to the property's id when known.
 */
export async function writeTokenProperty({ token, source, dtoProperty, value, existingId }) {
  const parentId = resolveTokenParentId(source, token);
  if (!parentId) return undefined;
  const entityName = ENTITY_NAME_BY_SOURCE[source];

  let id = existingId;
  if (!id) {
    const found = await ClientMediator
      .sendCommandAsync("Properties", "GetByNames", { parentId, names: [dtoProperty] })
      .catch(() => []);
    id = found?.find((p) => p.name === dtoProperty)?.id;
  }

  if (id) {
    WebSocketManagerInstance.Send(
      CommandFactory.CreatePropertyUpdateCommand({ id, name: dtoProperty, value, entityName, parentId })
    );
  } else {
    WebSocketManagerInstance.Send(
      CommandFactory.CreatePropertyAddCommand({ name: dtoProperty, value, isProtected: false, entityName, parentId })
    );
  }
  return id;
}
