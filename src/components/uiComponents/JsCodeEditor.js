import * as React from "react";
import { Box } from "@chakra-ui/react";

// CodeMirror with JavaScript highlighting, loaded on first use: it's large and only
// the action editor's script steps need it, so it stays out of the main bundle.
const LazyCodeMirror = React.lazy(async () => {
  const [{ default: CodeMirror }, { javascript }] = await Promise.all([
    import("@uiw/react-codemirror"),
    import("@codemirror/lang-javascript"),
  ]);
  const extensions = [javascript()];
  return { default: (props) => <CodeMirror extensions={extensions} {...props} /> };
});

export const JsCodeEditor = ({ minHeight, ...props }) => (
  <React.Suspense fallback={<Box minHeight={minHeight} />}>
    <LazyCodeMirror minHeight={minHeight} {...props} />
  </React.Suspense>
);

export default JsCodeEditor;
