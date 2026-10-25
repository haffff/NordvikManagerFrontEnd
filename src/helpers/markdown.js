// Addon readmes (the registry's "readme": a markdown file on raw.githubusercontent.com),
// rendered for the Addons panel. The text comes from outside, so: no raw HTML (markdown-it
// html: false), only http(s) links and https images, everything through DOMPurify. Relative
// links and images resolve against the readme's own folder, as they do on GitHub.
import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";
import { safeExternalUrl } from "./safeUrl";

const md = new MarkdownIt({ html: false, linkify: true });

const RAW = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.*)$/;

/** The folders relative URLs resolve against: raw files (images) and GitHub pages (links). */
export function readmeBases(sourceUrl) {
  const match = RAW.exec(typeof sourceUrl === "string" ? sourceUrl : "");
  if (!match) return null;
  const [, owner, repo, ref, path] = match;
  const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
  return {
    raw: `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${folder}`,
    page: `https://github.com/${owner}/${repo}/blob/${ref}/${folder}`,
  };
}

const isAbsolute = (url) => /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//");

function resolve(url, base) {
  if (!url) return null;
  if (isAbsolute(url)) return url;
  if (!base) return null;
  try { return new URL(url, base).href; } catch { return null; }
}

/** The readme as safe HTML ("" for none). */
export function renderReadme(markdown, sourceUrl) {
  if (!markdown) return "";
  const bases = readmeBases(sourceUrl);
  const tokens = md.parse(markdown, {});

  const walk = (list) => {
    for (const token of list) {
      if (token.type === "link_open") {
        const href = token.attrGet("href") ?? "";
        const target = href.startsWith("#") ? null : safeExternalUrl(resolve(href, bases?.page));
        if (target) {
          token.attrSet("href", target);
          token.attrSet("target", "_blank");
          token.attrSet("rel", "noopener noreferrer");
        } else {
          token.attrs = (token.attrs ?? []).filter(([name]) => name !== "href");
          token.attrSet("data-no-link", "");
        }
      }
      if (token.type === "image") {
        const src = resolve(token.attrGet("src") ?? "", bases?.raw);
        if (src && /^https:\/\//i.test(src)) token.attrSet("src", src);
        else token.attrSet("src", "");
      }
      if (token.children) walk(token.children);
    }
  };
  walk(tokens);

  const html = md.renderer.render(tokens, md.options, {});
  const clean = DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });

  // Images without a usable source go; links that lost theirs keep only their text.
  const host = document.createElement("div");
  host.innerHTML = clean;
  host.querySelectorAll("img").forEach((img) => { if (!img.getAttribute("src")) img.remove(); });
  host.querySelectorAll("a[data-no-link]").forEach((a) => a.replaceWith(...a.childNodes));
  return host.innerHTML;
}
