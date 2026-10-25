import React from "react";
import { Box, Spinner, Text } from "@chakra-ui/react";
import { ActiveWebHelper as WebHelper } from "../../../../../helpers/transport";
import { renderReadme } from "../../../../../helpers/markdown";
import "../../../../../stylesheets/markdown.css";

// Readmes already loaded this session, by addon key: { markdown, url }, or null for none.
const cache = new Map();

/** For tests: forget what was loaded. */
export const clearReadmeCache = () => cache.clear();

/**
 * An addon's readme from the server (GET addon/readme?key=, read from the registry entry's
 * "readme"): { status: "loading" | "ready" | "none" | "error", markdown, url }.
 */
export function useAddonReadme(addonKey, hasReadme = true) {
  const [state, setState] = React.useState({ status: "loading" });

  React.useEffect(() => {
    if (!addonKey || !hasReadme) { setState({ status: "none" }); return undefined; }
    if (cache.has(addonKey)) {
      const hit = cache.get(addonKey);
      setState(hit ? { status: "ready", ...hit } : { status: "none" });
      return undefined;
    }
    let live = true;
    setState({ status: "loading" });
    WebHelper.getAsync(`addon/readme?key=${encodeURIComponent(addonKey)}`)
      .then((body) => {
        const hit = body?.markdown ? { markdown: body.markdown, url: body.url } : null;
        cache.set(addonKey, hit);
        if (live) setState(hit ? { status: "ready", ...hit } : { status: "none" });
      })
      .catch(() => { if (live) setState({ status: "error" }); });
    return () => { live = false; };
  }, [addonKey, hasReadme]);

  return state;
}

/** Markdown rendered safely (see helpers/markdown), with the app's colours. */
export const MarkdownView = ({ markdown, url }) => {
  const html = React.useMemo(() => renderReadme(markdown, url), [markdown, url]);
  return <Box className="nm_markdown" dangerouslySetInnerHTML={{ __html: html }} />;
};

/** The readme of an addon, or its short description when it has none. */
export const AddonReadme = ({ addon }) => {
  const readme = useAddonReadme(addon?.key, Boolean(addon?.readme));
  if (readme.status === "loading") return <Spinner size="sm" />;
  if (readme.status === "ready") return <MarkdownView markdown={readme.markdown} url={readme.url} />;
  return (
    <Box>
      {addon?.description && <Text fontSize="sm">{addon.description}</Text>}
      {readme.status === "error" && <Text fontSize="xs" opacity={0.6} mt={2}>Couldn&apos;t load the readme.</Text>}
    </Box>
  );
};

export default AddonReadme;
