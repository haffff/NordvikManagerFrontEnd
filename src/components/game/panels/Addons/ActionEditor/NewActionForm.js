import * as React from "react";
import { Box, Button, HStack, Input, NativeSelect, Text } from "@chakra-ui/react";
import { T } from "./editorTheme";
import { ACTION_TEMPLATES } from "./actionTemplates";

// Prefix, name, and what the new action starts as: empty, or one of the templates.
export const NewActionForm = ({ onCreate, onCancel }) => {
  const [prefix, setPrefix] = React.useState("");
  const [name, setName] = React.useState("");
  const [templateKey, setTemplateKey] = React.useState("");
  const template = ACTION_TEMPLATES.find((t) => t.key === templateKey) ?? null;
  const submit = () => { if (name.trim()) onCreate(prefix.trim(), name.trim(), template); };
  return (
    <Box p={2} borderBottomWidth="1px" borderColor={T.border} bg={T.raised}>
      <HStack gap={1}>
        <Input size="xs" w="40%" placeholder="prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        <Input size="xs" autoFocus placeholder="action name" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }} />
      </HStack>
      <NativeSelect.Root size="xs" mt={1}>
        <NativeSelect.Field aria-label="Start from" value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
          <option value="">Empty action</option>
          {ACTION_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
      {template && <Text fontSize="2xs" color={T.muted} mt={1}>{template.description}</Text>}
      <HStack mt={1} justify="flex-end" gap={1}>
        <Button size="2xs" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="2xs" colorPalette="blue" variant="outline" onClick={submit} disabled={!name.trim()}>Create</Button>
      </HStack>
    </Box>
  );
};

export default NewActionForm;
