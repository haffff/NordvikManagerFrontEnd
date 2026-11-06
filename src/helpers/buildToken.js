// The client's copy of the server's BuildToken (BuildTokenCommandHandler): how a token
// file becomes the canvas object placed on the map. Real tokens are still built on the
// server; this one is for the token editor's preview. token-build-cases.json holds the
// cases both sides are tested with — change them together.

// Same as the server and TokenManager: tokens on the token layer, their UI above it.
const TOKEN_LAYER = 100;
const TOKEN_UI_LAYER = 110;

const clone = (value) => (value === undefined ? undefined : structuredClone(value));
const positive = (n) => (Number.isInteger(Number(n)) && Number(n) > 0 ? Number(n) : null);

/**
 * @param template the token file (token_*.json)
 * @param options  { gridSize, x, y, mapId, image, cardId?, name?, size? } — cardId, name and
 *                 size as the server reads them from a card (character_name, drop_token_size)
 * @returns {{ object, size }}
 */
export function buildToken(template, { gridSize, x = 0, y = 0, mapId, image = null, cardId = null, name = "Token", size } = {}) {
  // A card's token is the card's size (drop_token_size, else 1); only one placed without
  // a card takes the file's.
  const cells = (cardId ? positive(size) : positive(template.size)) ?? 1;
  const side = (gridSize > 0 ? gridSize : 50) * cells;

  const object = {
    ...clone(template.object ?? {}),
    name,
    left: x,
    top: y,
    width: side,
    height: side,
    scaleX: 1,
    scaleY: 1,
    cardId,
    isToken: true,
    mapId,
    layer: TOKEN_LAYER,
    resourceId: image,
  };

  const data = clone(template.tokenData ?? {});
  data.cardId = cardId;
  data.editableProps = clone(template.editableProps) ?? [];
  data.assignableIcons = clone(template.assignableIcons) ?? [];
  data.propDeps = [
    ...(data.propDeps ?? []),
    { dtoProperty: "tokenImage", objectProperty: "src", type: "string", source: cardId ? "card" : "element" },
  ];
  object.tokenData = data;

  object.tokenUiElements = (clone(template.additions) ?? []).map((element) => ({ ...element, layer: TOKEN_UI_LAYER }));

  // A circle crop without a radius covers the token; the client fits it to the picture.
  const clip = object.clipPath;
  if (clip?.type === "circle" && !(clip.radius > 0)) clip.radius = side / 2;

  return { object, size: cells };
}
