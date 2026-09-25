import * as React from "react";
import { Box, Text } from "@chakra-ui/react";
import { ActiveWebHelper as WebHelper } from "../transport";

// Renders the backend's "Html" chat template (HtmlChatTemplate.cs, posted via
// RollsController.Finish): sender-supplied HTML — e.g. an imported Roll20
// sheet's roll template — with its CSS, in a sandboxed iframe.
//
// Isolation: sandbox="allow-same-origin" WITHOUT allow-scripts, so nothing in
// the message can run (no <script>, no on* handlers, no javascript: links,
// no forms), while this component can still measure the content to size the
// iframe. Its CSS is scoped to the iframe and can't touch the app.
//
// Integrity: inline roll numbers never come from the HTML. The sender marks
// placeholders with data-roll-key="<key>"; they're filled here from
// object.rolls, which the server attached from its own roll session.
//
// Cost, since chat keeps every message mounted for the whole session:
//   - the iframe is only created once the message scrolls near the visible
//     chat area (a placeholder until then), so loading a long history
//     doesn't create one document per message up front;
//   - CSS is referenced by resource key and fetched once per key per client,
//     shared by every message that uses it — never carried per message.

const BG_CARD = "rgb(48,48,48)";
const BORDER_CLR = "rgb(65,65,65)";
const CLR_TITLE = "rgb(220,220,220)";
const PLACEHOLDER_HEIGHT = 48;

const cssCache = new Map(); // resource key -> Promise<string>
function loadCss(key) {
  if (!key) return Promise.resolve("");
  if (!cssCache.has(key)) {
    const url = WebHelper.getResourceString(undefined, key);
    cssCache.set(
      key,
      fetch(url, { credentials: "include" })
        .then((r) => (r.ok ? r.text() : ""))
        .catch(() => "")
    );
  }
  return cssCache.get(key);
}

// Crit/fumble detection works on kept dice only: a die that rolled its max is
// a crit, a 1 is a fumble. Which CSS classes those map to is the sender's
// call (data-roll-crit-class / -fumble-class / -both-class on the
// placeholder), so this renderer stays generic.
function describeRoll(roll) {
  const dice = (roll?.dices ?? []).filter((d) => d.kept !== false);
  const crit = dice.some((d) => d.diceValue > 1 && d.result === d.diceValue);
  const fumble = dice.some((d) => d.diceValue > 1 && d.result === 1);
  const detail = dice.map((d) => `d${d.diceValue}: ${d.result}`).join(", ");
  return { crit, fumble, title: detail ? `${roll.result} (${detail})` : String(roll?.result ?? "") };
}

export function buildMessageDocument(html, rolls, css) {
  const doc = new DOMParser().parseFromString(`<body>${html ?? ""}</body>`, "text/html");
  // Scripts couldn't run anyway (no allow-scripts); these could still
  // redirect or re-base the frame, so they're dropped outright.
  doc.querySelectorAll("script, meta, base, iframe, object, embed").forEach((el) => el.remove());
  // Inline handlers and javascript: URLs couldn't run either, but each one
  // makes the browser log "Blocked script execution in 'about:srcdoc'" —
  // drop them so a message never tries to run anything at all.
  doc.body.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      else if (["href", "src", "action", "formaction", "xlink:href"].includes(name) && /^\s*javascript:/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  });

  const byKey = new Map((rolls ?? []).map((entry) => [entry.key, entry.roll]));
  doc.querySelectorAll("[data-roll-key]").forEach((el) => {
    const roll = byKey.get(el.getAttribute("data-roll-key"));
    if (!roll) {
      el.textContent = "?";
      return;
    }
    const { crit, fumble, title } = describeRoll(roll);
    el.textContent = String(roll.result);
    el.setAttribute("title", title);
    const cls =
      crit && fumble ? el.getAttribute("data-roll-both-class")
      : crit ? el.getAttribute("data-roll-crit-class")
      : fumble ? el.getAttribute("data-roll-fumble-class")
      : null;
    if (cls) cls.split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
  });

  const safeCss = String(css ?? "").replace(/<\/style/gi, "<\\/style");
  return (
    "<!doctype html><html><head><meta charset=\"utf-8\">" +
    // Links are inert: with no allow-scripts/allow-popups, clicking one would
    // navigate the message's own iframe away (e.g. a Roll20 template's
    // [Reroll](~ability) link) and leave it blank.
    "<style>html,body{margin:0;padding:0;background:#fff;color:#000;overflow:hidden}a[href]{pointer-events:none;cursor:default}</style>" +
    `<style>${safeCss}</style></head><body>${doc.body.innerHTML}</body></html>`
  );
}

const SandboxedHtml = ({ html, rolls, cssResourceKey }) => {
  const hostRef = React.useRef(null);
  const frameRef = React.useRef(null);
  const [visible, setVisible] = React.useState(false);
  const [srcDoc, setSrcDoc] = React.useState(null);
  const [height, setHeight] = React.useState(PLACEHOLDER_HEIGHT);

  // Mount lazily: only once the message comes within 200px of the viewport.
  React.useEffect(() => {
    const el = hostRef.current;
    if (!el || visible) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  React.useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    loadCss(cssResourceKey).then((css) => {
      if (!cancelled) setSrcDoc(buildMessageDocument(html, rolls, css));
    });
    return () => {
      cancelled = true;
    };
  }, [visible, html, rolls, cssResourceKey]);

  // Size the iframe to its content, and keep it sized as fonts/images load.
  const onLoad = React.useCallback(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc?.documentElement) return;
    const measure = () => setHeight(Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0));
    measure();
    if (typeof ResizeObserver !== "undefined" && doc.body) {
      const observer = new ResizeObserver(measure);
      observer.observe(doc.body);
      frame._nmResizeObserver?.disconnect();
      frame._nmResizeObserver = observer;
    }
  }, []);

  React.useEffect(() => () => frameRef.current?._nmResizeObserver?.disconnect(), []);

  return (
    <Box ref={hostRef} minH={visible ? undefined : `${PLACEHOLDER_HEIGHT}px`}>
      {visible && srcDoc && (
        <iframe
          ref={frameRef}
          title="chat message"
          sandbox="allow-same-origin"
          srcDoc={srcDoc}
          onLoad={onLoad}
          style={{ display: "block", width: "100%", height: `${height}px`, border: 0, borderRadius: "4px" }}
        />
      )}
    </Box>
  );
};

export const HtmlChatTemplate = ({ object }) => {
  if (!object?.html) return null;
  return (
    <Box borderRadius="6px" borderWidth="1px" borderColor={BORDER_CLR} bg={BG_CARD} p="4px" my="2px" maxW="100%">
      {object.title && (
        <Text fontSize="12px" fontWeight="bold" color={CLR_TITLE} mb="4px" px="4px">
          {object.title}
        </Text>
      )}
      <SandboxedHtml html={object.html} rolls={object.rolls} cssResourceKey={object.cssResourceKey} />
    </Box>
  );
};
