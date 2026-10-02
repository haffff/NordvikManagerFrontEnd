import * as React from "react";
import { JsonEditor as JsonEditorLib } from "jsoneditor-react";
import "./JsonEditor.css";

/**
 * Thin shared wrapper around jsoneditor-react's <Editor>, used in place of the
 * old bare react-json-tree viewer (LookupPanel) and the old plain Textarea +
 * manual JSON.stringify/parse (ElementSettingsPanel's Direct Edit tab).
 *
 * jsoneditor-react bundles jsoneditor's "minimalist" build (no Ace editor —
 * confirmed via its own source, `import JSONEditor from 'jsoneditor/dist/jsoneditor-minimalist'`),
 * so the Ace-powered "code" mode (syntax-highlighted raw text) isn't available
 * here — "text" mode is used instead for raw-text editing (plain, unhighlighted,
 * but still a real editable JSON text view, which is what matters).
 *
 * IMPORTANT: jsoneditor-react's <Editor> only consumes `value` at MOUNT time —
 * its own shouldComponentUpdate only re-renders on `htmlElementProps` changing,
 * and componentDidUpdate never re-applies a changed `value` prop into the live
 * editor instance. A caller that needs to push in a value from OUTSIDE the
 * editor's own onChange (e.g. a live server update) must force a remount by
 * changing this component's `key` prop — this wrapper does not paper over that
 * itself, since only the caller knows whether a given value change originated
 * from its own onChange (no remount needed) or from elsewhere (remount needed).
 */
export const JsonEditor = ({ value, onChange, readOnly = false }) => (
  <div className="nm_json_editor_wrapper">
    <JsonEditorLib
      value={value}
      mode={readOnly ? "view" : "tree"}
      allowedModes={readOnly ? ["view"] : ["tree", "text"]}
      onChange={readOnly ? undefined : onChange}
      history={!readOnly}
      statusBar={!readOnly}
      htmlElementProps={{
        style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" },
      }}
    />
  </div>
);

export default JsonEditor;
