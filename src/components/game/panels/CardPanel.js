import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import useUUID from "../../uiComponents/hooks/useUUID";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import { ActiveWebHelper as WebHelper } from "../../../helpers/transport";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
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
 *   PROPERTY_EVENT  { eventType, name, propData, global?, parentId? }
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

    // Property events → PROPERTY_EVENT (avoids full re-fetch).
    // Events scoped to this card match Properties.Subscribe(name, cb) in the sandbox.
    // Anything else is tagged global + parentId so it matches
    // Properties.Global.Subscribe(parentId, name, cb) instead — that RPC surface
    // works on any entity's properties, not just this card's own.
    if (command === "property_add" || command === "property_update") {
      // PropertyDTO.ParentID is explicitly tagged [JsonProperty("parentId")]
      // server-side so it matches WebSocketCommandNames.DataKeyParentId — the
      // same key GameLobby's permission-filtered broadcast reads. The server
      // now always broadcasts a freshly serialized, canonical PropertyDTO for
      // every add/update/remove (PropertiesHandler.cs), so this casing is
      // consistent regardless of what triggered the change.
      const parentId = data?.parentId;
      if (parentId === cardId) {
        post({ type: "PROPERTY_EVENT", eventType: "update", name: data.name, propData: data });
      } else {
        post({ type: "PROPERTY_EVENT", eventType: "update", name: data.name, propData: data, global: true, parentId });
      }
      return;
    }
    if (command === "property_remove") {
      // Also a full PropertyDTO now (previously a bare property ID string with
      // no parentId at all, which made correct routing impossible).
      const parentId = data?.parentId;
      if (parentId === cardId) {
        post({ type: "PROPERTY_EVENT", eventType: "remove", name: data.name, propData: null });
      } else {
        post({ type: "PROPERTY_EVENT", eventType: "remove", name: data.name, propData: null, global: true, parentId });
      }
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
      // FireAction is routed through the real CardAPI method (not a raw send)
      // so cardId injection and the execute_action wire format live in one place.
      if (command === "execute_action" && data && typeof data === "object") {
        cardApi.FireAction(data.action, data.args);
        return;
      }
      cardApi.SendCustomCommandToServer(command, data);
      return;
    }

    // ── RPC: proxy CardAPI method calls ────────────────────────────────────
    if (type === "CMD") {
      try {
        let result;

        if (panel === "__register__") {
          // Scoped panel registration
          result = cardApi.ClientMediator.register(command, data);        } 
          
          else if (panel === "Properties") {
          const isGlobal = !!data?.global;
          const pid = data?.parentId;

          if (isGlobal) {
            // Global: parentId comes from the RPC payload — not forced to this card.
            const method = cardApi.Properties.Global[command];
            if (typeof method !== "function") throw new Error(`Unknown Properties.Global method: ${command}`);

            switch (command) {
              case "Get":
                result = await method(pid, data?.name);
                break;
              case "GetMany":
              case "GetByNames":
                result = await method(pid, data?.names ?? data?.name);
                break;
              case "GetProperties":
                result = await method(pid);
                break;
              case "Set":
                result = await method(pid, data?.name, data?.value);
                break;
              case "SetMany":
                result = await method(pid, data?.properties);
                break;
              case "Init":
                result = await method(pid, data?.name, data?.value);
                break;
              case "InitMany":
                result = await method(pid, data?.properties);
                break;
              case "Remove":
                result = await method(pid, data?.name);
                break;
              default:
                result = await method(pid, data?.name ?? data?.names, data?.value ?? data?.properties);
            }
          } else {
          // Scoped: parentId is always this card's ID.
          const method = cardApi.Properties[command];
          if (typeof method !== "function") throw new Error(`Unknown Properties method: ${command}`);

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
          }

        } else if (panel === "Resources") {
          const resourceTarget = data?.global ? cardApi.Resources.Global : cardApi.Resources;
          const method = resourceTarget[command];
          if (typeof method !== "function") throw new Error(`Unknown Resources method: ${command}`);

          switch (command) {
            case "Read":
            case "Delete":
              result = await method(data?.key);
              break;
            case "Update":
              result = await method(data?.key, data?.data, data?.mimeType);
              break;
            case "Create":
            case "Upsert":
              result = await method(data?.key, data?.data, data?.name, data?.mimeType);
              break;
            default:
              result = await method(data?.key, data?.data, data?.name, data?.mimeType);
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
  const sandboxUrlRef = React.useRef(null);

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

      // 3. Fetch additional resource metadata (including content) in parallel.
      //    ResourceMetadata returns { id, name, mimeType, data } where data is
      //    base64-encoded file content — same as the main resource above.
      //    We inline CSS/JS directly into the blob rather than using <link>/<script src>
      //    because the sandboxed iframe (null origin, no allow-same-origin) cannot
      //    make credentialed HTTP requests, and resources are now served over WebRTC.
      const additionalMetas = await Promise.all(
        (response?.additionalResources ?? []).map((resId) =>
          WebHelper.getAsync("materials/ResourceMetadata?id=" + resId).then(
            (meta) => ({ resId, mimeType: meta?.mimeType, data: meta?.data })
          )
        )
      );

      if (cancelled) return;

      // 4. Create a scoped CardAPI instance for this card
      const cardApi = await CardAPIFactory(id);
      if (cancelled) { cardApi.destroy(); return; }      // 5. Build the final blob HTML.
      //
      //    • Decode base64 main resource → raw HTML.
      //    • Inline CSS as <style> tags into <head> — content already fetched
      //      via WebRTC; no HTTP request needed from inside the iframe.
      //    • Inject the CardAPI bridge script + inline JS <script> tags before </body>.
      //    • The iframe gets a blob: URL → null origin, so it cannot access
      //      parent cookies / localStorage / DOM.

      const rawHtml = mainResourceMeta?.data ? atob(mainResourceMeta.data) : "<html><body></body></html>";

      // The card HTML is a CRA (or similar) production build whose asset paths
      // are root-relative (e.g. /static/js/main.abc.js).  When loaded as a
      // blob: URL those paths resolve against the null origin and 404.
      // Fix: rewrite every root-relative src="/" and href="/" to an absolute
      // URL using the card server's origin (derived from WebHelper.ApiAddress).
      const cardOrigin = (() => {
        const addr = WebHelper.ApiAddress;
        if (!addr) return "";
        try {
          return new URL(addr).origin;
        } catch (error) {
          return addr.replace(/\/api\/?$/, "");
        }
      })();
      const rebasedHtml = rawHtml.replace(
        /((?:src|href)=["'])\/(?!\/)/g,
        `$1${cardOrigin}/`
      );

      
      // Build <link rel="stylesheet"> tags for CSS using data URIs.
      // Using data URIs avoids any HTTP request from the null-origin iframe AND
      // avoids the </style> injection risk when CSS is decoded and inlined.
      const cssStyles = additionalMetas
        .filter((m) => m.mimeType === "text/css" && m.data)
        .map((m) => `<link rel="stylesheet" href="data:text/css;base64,${m.data}">`)
        .join("\n");

      // Build <script src="data:..."> tags for JS using data URIs.
      // Inlining JS as <script>code</script> is unsafe when the bundle contains
      // template literals that embed HTML (e.g. Vite's modulepreload polyfill
      // includes the full page HTML as a string), which can contain </script>
      // and prematurely terminate the outer script block. Base64 characters
      // (A-Za-z0-9+/=) can never form </script>, so the HTML parser is always safe.
      const jsScripts = additionalMetas
        .filter((m) => (m.mimeType === "text/javascript" || m.mimeType === "application/javascript") && m.data)
        .map((m) => `<script src="data:text/javascript;base64,${m.data}"></script>`)
        .join("\n");

      // Inject inline CSS into <head>
      let iframeHtml = cssStyles
        ? rebasedHtml.includes("</head>")
          ? rebasedHtml.replace("</head>", cssStyles + "\n</head>")
          : rebasedHtml.replace("<body", cssStyles + "\n<body")
        : rebasedHtml;

      // Inject bridge + JS scripts before </body> (append if tag absent)
      const bodyInjection = SANDBOX_BRIDGE_SCRIPT + (jsScripts ? "\n" + jsScripts : "");
      iframeHtml = iframeHtml.includes("</body>")
        ? iframeHtml.replace("</body>", bodyInjection + "\n</body>")
        : iframeHtml + bodyInjection;      // Revoke the previous blob URL before creating a new one (handles
      // the case where load() runs twice before cleanup, e.g. StrictMode).
      if (sandboxUrlRef.current) {
        URL.revokeObjectURL(sandboxUrlRef.current);
      }
      sandboxUrlRef.current = URL.createObjectURL(
        new Blob([iframeHtml], { type: "text/html" })
      );

      const iframe = iframeRef.current;      // 6. Mount the bridge BEFORE setting src so the message listener is
      //    already registered when SANDBOX_READY arrives.
      //    SANDBOX_READY is sent by the iframe after window 'load' (i.e. after
      //    all defer scripts have run and registered their cardapi:ready
      //    listeners), so INIT → cardapi:ready fires at the right time.
      cleanupRef.current = mountBridge(iframe, cardApi, id, additionalArguments);

      // Do NOT revoke the blob URL in onload — when the dockable panel is
      // moved in the DOM the browser resets the iframe and re-navigates to
      // the same blob URL.  We keep it alive for the full lifetime of the
      // component and revoke it only on unmount (see cleanup below).
      iframe.src = sandboxUrlRef.current;
    };

    load();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (sandboxUrlRef.current) {
        URL.revokeObjectURL(sandboxUrlRef.current);
        sandboxUrlRef.current = null;
      }
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
