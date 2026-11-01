import { placement, groupOf, tokenData, transform, readTransform, nameOfAdditions } from "./common";

// A clickable icon, e.g. "open the card". It shows while the token is selected, or always.
// onClick is a token action (schemas/token.json actionRef): a server action
// ({ Action, Args }) or an allowed client command ({ ClientMediatorAction }).

export const OPEN_CARD = Object.freeze({
  ClientMediatorAction: { panel: "Game", command: "CreateNewPanel", data: { type: "CardPanel", props: { id: "{{cardId}}" } } },
});

export const button = {
  id: "button",
  title: "Button",
  writes: [],
  create: ({ group, name = group, label = "Button" }) => ({
    group, name, label, iconPack: "gi", iconName: "GiNotebook", color: "rgba(255,255,255,0.95)", size: 20,
    onlySelected: true, onClick: structuredClone(OPEN_CARD), anchor: "top", offsetX: 0, offsetY: -4, rotation: 0,
  }),

  build(p) {
    return {
      additions: [{
        name: p.name, type: "reactIcon", iconPack: p.iconPack, iconName: p.iconName,
        left: 0, top: 0, width: p.size, height: p.size, originX: "center", originY: "bottom",
        fill: p.color, cursor: "pointer", visible: false, ...transform({ rotation: p.rotation }),
        tokenData: tokenData(p, { showOnTokenControl: p.onlySelected, actions: { onClick: p.onClick } }),
      }],
    };
  },

  match(additions) {
    if (additions.length !== 1) return null;
    const [part] = additions;
    const onClick = part.tokenData?.actions?.onClick;
    if (part.type !== "reactIcon" || !onClick || part.tokenData.propDeps?.length) return null;
    return {
      ...groupOf(part.tokenData), name: nameOfAdditions(additions), iconPack: part.iconPack, iconName: part.iconName, color: part.fill, size: part.width,
      onlySelected: !!part.tokenData.showOnTokenControl, onClick, ...placement(part.tokenData), ...readTransform(part, { scale: false }),
    };
  },
};
