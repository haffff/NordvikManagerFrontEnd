import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import useUUID from "../../uiComponents/hooks/useUUID";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import { ActiveWebHelper as WebHelper } from "../../../helpers/transport";
import WebSocketManagerInstance from "../WebSocketManager";
import { SANDBOX_BRIDGE_SCRIPT } from "./cardSandbox";
import CardAPIFactory from "../../../CardAPI";

// ─── postMessage bridge ───────────────────────────────────────────────────────

/**
 * Wires up the postMessage bridge between the host page and the sandboxed iframe.
 * Returns a cleanup function.
 *
 * Security model:
 *  • All addon code runs inside a blob:-URL iframe with sandbox="allow-scripts"
 *    (no allow-same-origin → no access to parent cookies / localStorage / DOM).
 *  • The iframe renders into a Shadow Root — addon CSS cannot leak out.
 *  • postMessage is the ONLY communication channel (structured-clone, no refs).
 *  • Every inbound CMD is validated against the CardAPI allowlist before execution.
 *
 * Protocol (parent → iframe):
 *   INIT            { cardId, additionalArguments }
 *   CMD_RESULT      { reqId, result, error? }
 *   PROPERTY_EVENT  { eventType, name, propData }
 *   WS_EVENT        { command, data }
 *   LOAD_RESOURCES  { scripts: string[], styles: string[] }
 *
 * Protocol (iframe → parent):
 *   SANDBOX_READY   {}
 *   CMD             { reqId, panel, command, data }
 *   WS_SEND         { command, data }
 */
function mountBridge(iframe, cardApi, cardId, additionalArguments) {
  let ready = false;
  const queue = [];

  const sendToFrame = (msg) => {
    iframe.contentWindow?.postMessage(msg, "*");
  };

  const flush = () => {
    queue.forEach(sendToFrame);
    queue.length = 0;
  };

  const post = (msg) => {
    if (ready) sendToFrame(msg);
    else queue.push(msg);
  };

  // ── parent → iframe: forward relevant WS / property events ─────────────
  const wsSubKey = "CardPanel_bridge_" + cardId + "_" + Math.random();

  WebSocketManagerInstance.Subscribe(wsSubKey, (message) => {
    const { command, data } = message;

    // Only forward events the sandbox is allowed to receive
    const allowed = ["property_", "chat_", "custom_", "action_"].some(
      (p) => command?.startsWith(p)
    );
    if (!allowed) return;

    // Property events scoped to this card → PROPERTY_EVENT (avoids full re-fetch)
    if (command === "property_add" || command === "property_update") {
      if (data?.parentId !== cardId) return;
      post({ type: "PROPERTY_EVENT", eventType: "update", name: data.name, propData: data });
      return;
    }
    if (command === "property_remove") {
      if (data?.parentId !== cardId) return;
      post({ type: "PROPERTY_EVENT", eventType: "remove", name: data.name, propData: null });
      return;
    }

    // Everything else (chat, custom, action) forwarded as a generic WS_EVENT
    post({ type: "WS_EVENT", command, data });
  });

  // ── iframe → parent: handle RPC and WS send requests ───────────────────
  const onMessage = async (event) => {
    if (event.source !== iframe.contentWindow) return;
    const { type, reqId, panel, command, data } = event.data ?? {};

    // ── Handshake ──────────────────────────────────────────────────────────
    if (type === "SANDBOX_READY") {
      ready = true;
      sendToFrame({ type: "INIT", cardId, additionalArguments });
      flush();
      return;
    }

    // ── Outbound WS command ────────────────────────────────────────────────
    if (type === "WS_SEND") {
      cardApi.SendCustomCommandToServer(command, data);
      return;
    }

    // ── RPC: proxy CardAPI method calls ────────────────────────────────────
    if (type === "CMD") {
      try {
        let result;

        if (panel === "__register__") {
          // Scoped panel registration
          result = cardApi.ClientMediator.register(command, data);        } else if (panel === "Properties") {
          // Route ALL Properties commands through CardAPI.Properties so every
          // call benefits from the prefilled cache.  parentId is always forced
          // to this card's ID — the card cannot read another card's properties.
          const method = cardApi.Properties[command];
          if (typeof method !== "function") throw new Error(`Unknown Properties method: ${command}`);

          // Dispatch by method name so every argument shape is handled correctly.
          switch (command) {
            case "Get":
              result = await method(data?.name);
              break;
            case "GetMany":
            case "GetByNames":
              result = await method(data?.names ?? data?.name);
              break;
            case "GetProperties":
              result = await method();
              break;
            case "Set":
              result = await method(data?.name, data?.value);
              break;
            case "SetMany":
              result = await method(data?.properties);
              break;
            case "Init":
              result = await method(data?.name, data?.value);
              break;
            case "InitMany":
              result = await method(data?.properties);
              break;
            case "Remove":
              result = await method(data?.name);
              break;
            default:
              result = await method(data?.name ?? data?.names, data?.value ?? data?.properties);
          }

        } else {
          // Generic allowlisted ClientMediator command
          result = await cardApi.ClientMediator.sendCommandAsync(panel, command, data);
        }

        sendToFrame({ type: "CMD_RESULT", reqId, result: result ?? null });
      } catch (err) {
        sendToFrame({ type: "CMD_RESULT", reqId, result: null, error: String(err) });
      }
    }
  };

  window.addEventListener("message", onMessage);

  return () => {
    window.removeEventListener("message", onMessage);
    WebSocketManagerInstance.Unsubscribe(wsSubKey);
    cardApi.destroy();
  };
}

// ─── CardPanel ────────────────────────────────────────────────────────────────

export const CardPanel = ({ id, name }) => {
  const panelId = useUUID();
  const iframeRef = React.useRef(null);
  const cleanupRef = React.useRef(null);

  const ctx = Dockable.useContentContext();
  ctx.setTitle(name);

  React.useEffect(() => {
    if (!panelId) return;

    let cancelled = false;    const load = async () => {
      // 1. Fetch card definition + additional arguments in parallel
      const [response, properties] = await Promise.all([
        WebHelper.getAsync("materials/getcard?id=" + id),
        WebHelper.getAsync(
          "properties/QueryProperties?parentIds=" + id + "&names=additionalArguments"
        ),
      ]);

      if (cancelled || !iframeRef.current) return;

      const additionalArguments = properties?.[0]?.value ?? null;

      // 2. Fetch main resource metadata.
      //    The main resource is ALWAYS text/html.
      //    ResourceMetadata returns { id, name, mimeType, data } where data is
      //    the file content encoded as base64.
      const mainResourceMeta = response?.mainResource
        ? await WebHelper.getAsync("materials/ResourceMetadata?id=" + response.mainResource)
        : null;

      if (cancelled) return;

      // 3. Fetch additional resource metadata in parallel so we know their
      //    mimeTypes before building the blob (CSS → <link>, JS → <script>).
      const additionalMetas = await Promise.all(
        (response?.additionalResources ?? []).map((resId) =>
          WebHelper.getAsync("materials/ResourceMetadata?id=" + resId).then(
            (meta) => ({ resId, mimeType: meta?.mimeType })
          )
        )
      );

      if (cancelled) return;

      // 4. Create a scoped CardAPI instance for this card
      const cardApi = await CardAPIFactory(id);
      if (cancelled) { cardApi.destroy(); return; }      // 5. Build the final blob HTML.
      //
      //    • Decode base64 main resource → raw HTML.
      //    • Inject CSS <link> tags into <head> — safe because the iframe is
      //      cross-origin (blob: null origin) so these styles never reach the
      //      parent page. No Shadow DOM needed; the iframe IS the boundary.
      //    • Inject the CardAPI bridge script + JS <script> tags before </body>.
      //    • The iframe gets a blob: URL → null origin, so it cannot access
      //      parent cookies / localStorage / DOM.

      const rawHtml = mainResourceMeta?.data ? atob(mainResourceMeta.data) : "<html><body></body></html>";

      // The card HTML is a CRA (or similar) production build whose asset paths
      // are root-relative (e.g. /static/js/main.abc.js).  When loaded as a
      // blob: URL those paths resolve against the null origin and 404.
      // Fix: rewrite every root-relative src="/" and href="/" to an absolute
      // URL using the card server's origin (derived from WebHelper.ApiAddress).
      const cardOrigin = WebHelper.ApiAddress.replace(/\/api$/, "");
      const rebasedHtml = rawHtml.replace(
        /((?:src|href)=["'])\/(?!\/)/g,
        `$1${cardOrigin}/`
      );

      // Build <link> tags for CSS additional resources — injected into <head>
      const cssLinks = additionalMetas
        .filter((m) => m.mimeType === "text/css")
        .map((m) => `<link rel="stylesheet" href="${WebHelper.getResourceString(m.resId)}">`)
        .join("\n");

      // Build <script> tags for JS additional resources
      const scriptClose = "</script>";
      const jsScripts = additionalMetas
        .filter((m) => m.mimeType === "text/javascript" || m.mimeType === "application/javascript")
        .map((m) => `<script src="${WebHelper.getResourceString(m.resId)}">${scriptClose}`)
        .join("\n");      // Inject CSS links into <head>
      let iframeHtml = cssLinks
        ? rebasedHtml.includes("</head>")
          ? rebasedHtml.replace("</head>", cssLinks + "\n</head>")
          : rebasedHtml.replace("<body", cssLinks + "\n<body")
        : rebasedHtml;

      // Inject bridge + JS scripts before </body> (append if tag absent)
      const bodyInjection = SANDBOX_BRIDGE_SCRIPT + (jsScripts ? "\n" + jsScripts : "");
      iframeHtml = iframeHtml.includes("</body>")
        ? iframeHtml.replace("</body>", bodyInjection + "\n</body>")
        : iframeHtml + bodyInjection;      const sandboxUrl = URL.createObjectURL(
        new Blob([iframeHtml], { type: "text/html" })
      );

      const iframe = iframeRef.current;      // 6. Mount the bridge BEFORE setting src so the message listener is
      //    already registered when SANDBOX_READY arrives.
      //    SANDBOX_READY is sent by the iframe after window 'load' (i.e. after
      //    all defer scripts have run and registered their cardapi:ready
      //    listeners), so INIT → cardapi:ready fires at the right time.
      cleanupRef.current = mountBridge(iframe, cardApi, id, additionalArguments);

      iframe.onload = () => {
        if (cancelled) return;
        URL.revokeObjectURL(sandboxUrl);
      };

      iframe.src = sandboxUrl;
    };

    load();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [panelId, id]);

  if (!panelId) return <>Loading...</>;
  return (
    <BasePanel style={{ display: "flex", padding: 0 }} id={panelId}>
      <iframe
        ref={iframeRef}
        title={`card-${id}`}
        /**
         * Sandbox permissions:
         *   allow-scripts     — addon JS must be able to run
         *
         * Intentionally OMITTED (security):
         *   allow-same-origin   — omitting this means the iframe gets a null
         *                         origin; it cannot access parent localStorage,
         *                         cookies, or DOM, even via blob: URL tricks.
         *   allow-top-navigation
         *   allow-forms
         *   allow-popups
         *   allow-modals
         */
        sandbox="allow-scripts"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          background: "transparent",
        }}
      />
    </BasePanel>
  );
};

export default CardPanel;
