import * as React from "react";
import { Box, Button, HStack, Input, NativeSelect, Text, Textarea } from "@chakra-ui/react";
import { T } from "./editorTheme";
import { ACTION_TEMPLATES } from "./actionTemplates";
import { parseActionJson } from "./importAction";

// Prefix, name, and what the new action starts as: empty, one of the templates, or pasted
// JSON (an exported action, an addon action file, or one an AI assistant wrote). Pasted JSON
// gives the prefix and name too unless they are typed. stepTypes: the server's step types,
// to catch made-up ones.
export const NewActionForm = ({ onCreate, onCancel, stepTypes }) => {
  const [prefix, setPrefix] = React.useState("");
  const [name, setName] = React.useState("");
  const [templateKey, setTemplateKey] = React.useState("");
  const [json, setJson] = React.useState("");
  const [error, setError] = React.useState(null);
  const pasting = templateKey === "json";
  const template = ACTION_TEMPLATES.find((t) => t.key === templateKey) ?? null;

  const submit = () => {
    if (!pasting) { if (name.trim()) onCreate(prefix.trim(), name.trim(), template); return; }
    const { action, error: problem } = parseActionJson(json, stepTypes);
    if (problem) { setError(problem); return; }
    const finalName = name.trim() || action.name.trim();
    if (!finalName) { setError("Give the action a name."); return; }
    onCreate(prefix.trim() || action.prefix.trim(), finalName,
      { hook: action.hook, description: action.description, content: action.content });
  };

  return (
    <Box p={2} borderBottomWidth="1px" borderColor={T.border} bg={T.raised}>
      <HStack gap={1}>
        <Input size="xs" w="40%" placeholder="prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        <Input size="xs" autoFocus placeholder={pasting ? "action name (or from the JSON)" : "action name"} value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }} />
      </HStack>
      <NativeSelect.Root size="xs" mt={1}>
        <NativeSelect.Field aria-label="Start from" value={templateKey} onChange={(e) => { setTemplateKey(e.target.value); setError(null); }}>
          <option value="">Empty action</option>
          {ACTION_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          <option value="json">Paste JSON…</option>
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
      {template && <Text fontSize="2xs" color={T.muted} mt={1}>{template.description}</Text>}
      {pasting && (
        <>
          <Textarea size="xs" mt={1} rows={6} fontFamily="mono" aria-label="Action JSON"
            placeholder={'{ "name": "…", "hook": 0, "content": [ { "Type": "…", "Data": { } } ] }'}
            value={json} onChange={(e) => { setJson(e.target.value); setError(null); }} />
          {error
            ? <Text fontSize="2xs" color="red.300" mt={1}>{error}</Text>
            : <Text fontSize="2xs" color={T.muted} mt={1}>An exported action, an addon action file, or one an AI assistant wrote.</Text>}
        </>
      )}
      <HStack mt={1} justify="flex-end" gap={1}>
        <Button size="2xs" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="2xs" colorPalette="blue" variant="outline" onClick={submit} disabled={pasting ? !json.trim() : !name.trim()}>Create</Button>
      </HStack>
    </Box>
  );
};

export default NewActionForm;
