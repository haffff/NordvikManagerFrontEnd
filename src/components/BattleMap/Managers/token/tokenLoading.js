import { fabric } from "fabric";
import { ActiveWebHelper as WebHelper } from "../../../../helpers/transport";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ICON_PACK_LOADERS } from "../../../../helpers/ReactIconPackLoaders";
import { TOKEN_UI_LAYER, _isGuid } from "./shared";

// Building a token's parts: elements, icons, SVGs and its picture.
/**
 * Fetch a material by id-or-key, routing correctly to ?id= or ?key=.
 */
function _getMaterial(idOrKey, mimeType) {
  return _isGuid(idOrKey)
    ? WebHelper.getMaterialAsync(idOrKey, mimeType)
    : WebHelper.getMaterialAsync(null, mimeType, idOrKey);
}

export const tokenLoading = {
  meta: {
    CanvasObjectLoadToken: {
      description:
        "Enlives and attaches token UI elements for an already-loaded canvas object.",
      args: [{ name: "id", type: "string", required: true }],
    },
  },

  methods: {
    // ── Public commands ─────────────────────────────────────────────────────

    /**
     * Revive all token UI element specs into live Fabric objects.
     *
     * Three spec types are supported:
     *
     * • Standard Fabric types (rect, text, path, image, group, …):
     *   Handled by `fabric.util.enlivenObjects`.
     *
     * • `"type": "svg"` — inline SVG string or resource URL:
     *   Fields: `svgString` (inline markup) or `src` (resource ID / URL).
     *   Uses `fabric.loadSVGFromString` → `fabric.util.groupSVGElements`.
     *
     * • `"type": "reactIcon"` — a react-icons icon, loaded by pack name:
     *   Fields: `iconPack` (e.g. `"gi"`, `"fa"`, `"md"`) and `iconName`
     *   (the named export, e.g. `"GiPoisonBottle"`).  The pack is imported
     *   dynamically so only the requested pack is included in the chunk.
     *   The icon component is rendered to an SVG string via
     *   `renderToStaticMarkup`, then fed into the same SVG pipeline as above.
     *
     * Token JSON examples:
     *   { "name": "status_poisoned", "type": "svg", "width": 20, "height": 20,
     *     "svgString": "<svg ...>...</svg>", "tokenData": { "anchor": "right-top" } }
     *
     *   { "name": "status_poisoned", "type": "reactIcon",
     *     "iconPack": "gi", "iconName": "GiPoisonBottle",
     *     "width": 20, "height": 20, "fill": "rgba(50,200,50,0.9)",
     *     "tokenData": { "anchor": "right-top", ... } }
     */
    async _enlivenTokenUiElements(specs) {
      const indices = { svg: [], reactIcon: [], fabric: [] };
      specs.forEach((s, i) => {
        if (s.type === "svg") indices.svg.push(i);
        else if (s.type === "reactIcon") indices.reactIcon.push(i);
        else indices.fabric.push(i);
      });

      const svgResults = await Promise.all(
        indices.svg.map((i) => this._loadSVGElement(specs[i]))
      );

      const reactIconResults = await Promise.all(
        indices.reactIcon.map((i) => this._loadReactIconElement(specs[i]))
      );

      const fabricSpecs = indices.fabric.map((i) => specs[i]);
      const fabricResults = await new Promise((resolve) => {
        if (!fabricSpecs.length) { resolve([]); return; }
        fabric.util.enlivenObjects(fabricSpecs, resolve);
      });

      // Reconstruct in original order
      const out = new Array(specs.length);
      let si = 0, ri = 0, fi = 0;
      specs.forEach((_, i) => {
        if (specs[i].type === "svg") out[i] = svgResults[si++];
        else if (specs[i].type === "reactIcon") out[i] = reactIconResults[ri++];
        else out[i] = fabricResults[fi++];
      });

      return out.filter(Boolean);
    },

    /**
     * Load a `"type": "reactIcon"` spec into a Fabric Group via the SVG pipeline.
     *
     * The icon pack is imported dynamically (code-split per pack) so only packs
     * referenced by tokens in the current session are ever fetched.
     * `renderToStaticMarkup` converts the React icon component to an SVG string,
     * which is then handed off to `_loadSVGElement`.
     *
     * Spec fields:
     *   iconPack   {string} react-icons sub-package, e.g. "gi", "fa", "md"
     *   iconName   {string} named export from the pack, e.g. "GiPoisonBottle"
     *   width      {number} rendered size (px) — also passed as `size` to the icon
     *   height     {number} rendered size (px)
     *   fill       {string} icon colour, e.g. "rgba(50,200,50,0.9)"
     *   …any other spec fields (left, top, originX/Y, tokenData, …) pass through
     */
    async _loadReactIconElement(spec) {
      const { iconPack, iconName } = spec;
      if (!iconPack || !iconName) {
        console.warn(
          `TokenManager: reactIcon "${spec.name}" requires both "iconPack" and "iconName"`
        );
        return null;
      }

      const loader = ICON_PACK_LOADERS[iconPack];
      if (!loader) {
        console.warn(
          `TokenManager: unknown react-icons pack "${iconPack}" for element "${spec.name}". ` +
          `Supported packs: ${Object.keys(ICON_PACK_LOADERS).join(', ')}`
        );
        return null;
      }

      let pack;
      try {
        pack = await loader();
      } catch {
        console.warn(
          `TokenManager: could not load react-icons pack "${iconPack}" for element "${spec.name}"`
        );
        return null;
      }

      const IconComponent = pack[iconName];
      if (!IconComponent) {
        console.warn(
          `TokenManager: icon "${iconName}" not found in react-icons/${iconPack}`
        );
        return null;
      }

      // renderToStaticMarkup is synchronous and works in browser builds — it does not
      // require any Node.js APIs. The previous approach (flushSync + createRoot) inside
      // an async function was unreliable: React 18 concurrent mode does not guarantee
      // the initial render of a new root completes synchronously in an async context,
      // so container.innerHTML was empty and the element was silently dropped.
      const size = spec.width ?? spec.height ?? 24;
      const fill = spec.fill ?? "#ffffff";
      let svgMarkup = renderToStaticMarkup(
        createElement(IconComponent, { size, color: fill })
      );

      if (!svgMarkup) {
        console.warn(`TokenManager: reactIcon "${spec.name}" rendered empty markup`);
        return null;
      }

      // react-icons uses fill="currentColor" on paths — Fabric's SVG parser cannot
      // resolve CSS-inherited `currentColor`, so replace it with the explicit color.
      svgMarkup = svgMarkup.replace(/currentColor/g, fill);

      // Delegate to the shared SVG loader — all positional/tokenData props carry through
      return this._loadSVGElement({ ...spec, svgString: svgMarkup });
    },

    /**
     * Load a single `"type": "svg"` spec into a Fabric Group.
     * Applies positional / visual properties from the spec onto the group.
     */
    async _loadSVGElement(spec) {
      let svgMarkup = spec.svgString;

      if (!svgMarkup && spec.src) {
        const data = await _getMaterial(spec.src, "text/plain").catch(() => null);
        svgMarkup = typeof data === "string" ? data : null;
      }

      if (!svgMarkup) {
        console.warn(`TokenManager: SVG element "${spec.name}" has no svgString or src`);
        return null;
      }

      return new Promise((resolve) => {
        fabric.loadSVGFromString(svgMarkup, (objects, options) => {
          if (!objects?.length) {
            console.warn(`TokenManager: SVG element "${spec.name}" parsed no objects`);
            resolve(null);
            return;
          }

          const group = fabric.util.groupSVGElements(objects, options);

          // Apply spec properties onto the group
          group.set({
            name:     spec.name,
            left:     spec.left     ?? 0,
            top:      spec.top      ?? 0,
            originX:  spec.originX  ?? "left",
            originY:  spec.originY  ?? "top",
            scaleX:   spec.scaleX   ?? 1,
            scaleY:   spec.scaleY   ?? 1,
            angle:    spec.angle    ?? 0,
            opacity:  spec.opacity  ?? 1,
            visible:  spec.visible  ?? true,
            tokenData: spec.tokenData,
          });

          // Scale to declared dimensions (preserves aspect ratio via scaleToWidth)
          if (spec.width && spec.height) {
            group.scaleToWidth(spec.width);
            group.scaleToHeight(spec.height);
          } else if (spec.width) {
            group.scaleToWidth(spec.width);
          } else if (spec.height) {
            group.scaleToHeight(spec.height);
          }

          resolve(group);
        });
      });
    },

    /**
     * Enliven and attach token UI elements for an already-loaded canvas object.
     */
    async CanvasObjectLoadToken({ id }) {
      const canvas = this._getCanvas();
      const object = this._findObject(id);

      if (!object) {
        console.warn(
          `TokenManager.CanvasObjectLoadToken: object "${id}" not found`
        );
        return;
      }

      this._fitTokenPicture(object);

      if (!object.tokenUiElements?.length) return;

      const enlivened = await this._enlivenTokenUiElements(object.tokenUiElements);

      object.additionalObjects = object.additionalObjects || [];

      enlivened.forEach((element) => {
        // Layer & selectability
        element.layer = TOKEN_UI_LAYER;
        element.selectable = false;
        element.isTokenUI = true;
        // Its token: the UI is shown, hidden and clicked with that token's layer (drawLayerOf).
        element.uiOf = object;

        // Hide every element until deps are applied — prevents Fabric from
        // trying to cache a 0-dimension element (e.g. text with empty string).
        element.visible = false;

        // Editable i-text: enter editing on double-click, exit on click-away
        if (element.type === "i-text" && element.editable) {
          element.on("mousedblclick", (e) => {
            e.target.enterEditing();
            e.target.selectAll();
            const exitHandler = () => {
              e.target.exitEditing();
              canvas.off("mouse:down", exitHandler);
            };
            canvas.on("mouse:down", exitHandler);
          });
        }

        // Wire all declared token UI actions (onClick, onHover, onDblClick, …)
        if (element.tokenData?.actions) {
          this._wireTokenUIActions(element, object);
        }

        object.additionalObjects.push(element);
        canvas.add(element);
      });

      this.UpdateTokenUIPositions({ object });
      // UpdateTokenBasedOnProperties restores visibility after applying deps
      this.UpdateTokenBasedOnProperties({ tokenId: id });
    },

    // The server builds a token as wide as it should be at scale 1 (it doesn't know the
    // picture's size), so Fabric would show the picture cropped to that square. The token
    // keeps the width it shows, with the whole picture at its own size scaled to it, and
    // an automatic circle crop (sized to the square) fitted to the picture — as setSrc does.
    _fitTokenPicture(token) {
      if (token?.type !== "image") return;
      const picture = token.getElement?.();
      const w = picture?.naturalWidth || picture?.width;
      const h = picture?.naturalHeight || picture?.height;
      if (!w || !h || (token.width === w && token.height === h)) return;
      const shownWidth = token.width * (token.scaleX ?? 1);
      const oldMin = Math.min(token.width, token.height);
      token.set({ width: w, height: h });
      token.scale(shownWidth / w);
      const clip = token.clipPath;
      if (clip?.type === "circle" && clip.radius === oldMin / 2) {
        clip.set("radius", Math.min(w, h) / 2);
      }
      token.setCoords?.();
    },
  },
};
