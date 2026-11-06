import * as React from "react";
import { Button, Flex, IconButton, Input, NativeSelect, Stack, Table, Text, parseColor } from "@chakra-ui/react";
import { FaPlus } from "@react-icons/all-files/fa/FaPlus";
import { FaTimes } from "@react-icons/all-files/fa/FaTimes";
import { DColorPicker } from "../components/uiComponents/settingsComponents/ColorPicker";
import { DynamicIcon } from "../components/uiComponents/icons/DynamicIcon";
import { DynamicIconChooser } from "../components/uiComponents/icons/DynamicIconChooser";
import { Switch } from "../components/ui/switch";

// The token editor's settings tables (Parts, Quick-edit fields): a label and a control
// on each row, sections between, with the game's own colour and icon pickers.

// ── Controls ─────────────────────────────────────────────────────────────────

// "transparent" is a colour the picker can't read: shown as clear, written back only
// when the user changes it. A colour it can't read at all (a CSS variable) is text only.
const pickerColor = (value) => {
  if (!value) return { ok: true, color: undefined };
  const color = value === "transparent" ? "rgba(0,0,0,0)" : value;
  try {
    parseColor(color);
    return { ok: true, color };
  } catch {
    return { ok: false };
  }
};

export function ColorField({ label, value, onChange }) {
  const { ok, color } = pickerColor(value);
  return (
    <Flex gap="6px" align="center">
      {ok && <DColorPicker minimal initColor={color} onValueChange={onChange} />}
      <Input size="xs" aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </Flex>
  );
}

export function IconField({ iconPack, iconName, onChange }) {
  return (
    <Stack gap="2px" align="flex-start">
      {iconPack !== "gi" && iconName && (
        <Flex gap="6px" align="center">
          <DynamicIcon iconPack={iconPack} iconName={iconName} iconProps={{ size: 28 }} />
          <Text fontSize="xs" color="fg.muted">{iconPack}/{iconName}</Text>
        </Flex>
      )}
      {/* The chooser lists game-icons; a token's icon is required, so no "Remove icon". */}
      <DynamicIconChooser allowRemove={false} iconSelected={iconPack === "gi" ? iconName : null} onSelect={(key) => key && onChange({ iconPack: "gi", iconName: key })} />
    </Stack>
  );
}

export function Control({ field, value, onChange, params }) {
  const { label, kind, options } = field;
  if (kind === "checkbox") {
    return <Switch size="sm" checked={!!value} onCheckedChange={({ checked }) => onChange(checked)} inputProps={{ "aria-label": label }} />;
  }
  if (kind === "select") {
    return (
      <NativeSelect.Root size="xs">
        <NativeSelect.Field aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
          {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    );
  }
  if (kind === "color") return <ColorField label={label} value={value} onChange={onChange} />;
  if (kind === "icon") return <IconField iconPack={params.iconPack} iconName={params.iconName} onChange={onChange} />;
  return (
    <Input
      size="xs"
      aria-label={label}
      type={kind === "number" ? "number" : "text"}
      value={value ?? ""}
      onChange={(e) => onChange(kind === "number" ? Number(e.target.value) || 0 : e.target.value)}
    />
  );
}

// ── Table pieces ─────────────────────────────────────────────────────────────

export const Section = ({ title }) => (
  <Table.Row>
    <Table.ColumnHeader scope="row" colSpan={2} pt="10px" pb="4px" fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="fg.muted" borderBottomWidth="1px">
      {title}
    </Table.ColumnHeader>
  </Table.Row>
);

export const FieldRow = ({ label, children }) => (
  <Table.Row>
    <Table.Cell py="3px" pr="8px" w="40%" fontSize="xs" verticalAlign="middle" borderBottomWidth="0">{label}</Table.Cell>
    <Table.Cell py="3px" borderBottomWidth="0">{children}</Table.Cell>
  </Table.Row>
);

export const WideRow = ({ children }) => (
  <Table.Row>
    <Table.Cell colSpan={2} py="4px" borderBottomWidth="0">{children}</Table.Cell>
  </Table.Row>
);

// A list edited as a small table (a bar's colour steps, a rule's value table): one row per
// item, a column per field, a remove button on each and an add button under it.
export function Rows({ items, columns, onChange, addLabel, make }) {
  const change = (i, patch) => onChange(items.map((item, j) => (j === i ? { ...item, ...patch } : item)));
  const what = addLabel.replace(/^Add /, "");
  return (
    <Stack gap="4px">
      <Table.Root size="sm" variant="outline">
        <Table.Header>
          <Table.Row>
            {columns.map(([key, label]) => <Table.ColumnHeader key={key} fontSize="xs" py="3px">{label}</Table.ColumnHeader>)}
            <Table.ColumnHeader w="28px" />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {items.map((item, i) => (
            <Table.Row key={i}>
              {columns.map(([key, label, kind]) => (
                <Table.Cell key={key} py="3px">
                  {kind === "color"
                    ? <ColorField label={label} value={item[key]} onChange={(v) => change(i, { [key]: v })} />
                    : <Input size="xs" aria-label={label} placeholder={label} type={kind === "number" ? "number" : "text"} value={item[key] ?? ""}
                        onChange={(e) => change(i, { [key]: kind === "number" ? Number(e.target.value) || 0 : e.target.value })} />}
                </Table.Cell>
              ))}
              <Table.Cell py="3px">
                <IconButton size="2xs" variant="ghost" aria-label={`Remove ${what}`} onClick={() => onChange(items.filter((_, j) => j !== i))}><FaTimes /></IconButton>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      <div><Button size="2xs" variant="outline" onClick={() => onChange([...items, make(items)])}><FaPlus /> {addLabel}</Button></div>
    </Stack>
  );
}
