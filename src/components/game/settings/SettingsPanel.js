import * as React from "react";
import {
  Box,
  Textarea,
  Flex,
  Card,
  Input,
  Field,
  HStack,
  Button,
  Heading,
  For,
  FieldErrorText,
  createListCollection,
  Stack,
  Text,
  Separator,
} from "@chakra-ui/react";
import {
  SelectRoot,
  SelectItem,
  SelectValueText,
  SelectContent,
  SelectTrigger,
} from "../../ui/select";
import { Switch } from "../../ui/switch";
import { NumberInputField, NumberInputRoot } from "../../ui/number-input";
import { ActiveWebHelper as WebHelper } from "../../../helpers/transport";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import DynamicIconChooser from "../../uiComponents/icons/DynamicIconChooser";
import { MaterialChooser } from "../../uiComponents/MaterialChooser";
import { PlayerChooser } from "../../uiComponents/PlayerChooser";
import { SearchInput } from "../../uiComponents/SearchInput";
import { DColorPicker } from "../../uiComponents/settingsComponents/ColorPicker";
import ResourceImage from "../../uiComponents/ResourceImage";

// ─── Field card wrapper ────────────────────────────────────────────────────────

const SettingFieldCard = ({ fieldKey, editable, disabled, validationError, children }) => (
  <Card.Root
    key={fieldKey}
    style={{
      backgroundColor: "rgba(40,40,40,0.5)",
      color: "white",
      opacity: disabled ? 0.5 : 1,
      transition: "opacity 0.15s ease",
    }}
    variant="outline"
    padding={3}
    margin={1}
    size="sm"
  >
    <Field.Root invalid={!!validationError} required={editable.required}>
      <Field.Label fontWeight="medium" fontSize="sm" color="gray.200">
        {editable.label}
        <Field.RequiredIndicator />
      </Field.Label>
      {editable.toolTip && (
        <Text fontSize="xs" color="gray.400" mb={1}>
          {editable.toolTip}
        </Text>
      )}
      {validationError && (
        <FieldErrorText fontSize="xs">
          <Field.ErrorIcon boxSize="14px" />
          {validationError}
        </FieldErrorText>
      )}
      {children}
    </Field.Root>
  </Card.Root>
);

// ─── Input factory ─────────────────────────────────────────────────────────────

const buildInput = (editable, key, value, validationError, disabled, OnChange) => {
  switch (editable.type) {
    case "string":
      return (
        <Input
          disabled={disabled}
          defaultValue={value}
          onChange={(e) => OnChange(key, e.target.value)}
        />
      );

    case "select": {
      const collection = createListCollection({ items: editable.options });
      return (
        <SelectRoot
          disabled={disabled}
          collection={collection}
          value={[value]}
          onValueChange={(e) => OnChange(key, e.value[0])}
        >
          <SelectTrigger>
            <SelectValueText placeholder="Select...">
              {(items) => {
                const found = items.find((x) => x.value === value);
                return <>{found ? found.label : "Select..."}</>;
              }}
            </SelectValueText>
          </SelectTrigger>
          <SelectContent zIndex={9999}>
            <For each={collection.items}>
              {(option, index) => (
                <SelectItem key={index} selected={value === option.value} item={option}>
                  {option.label}
                </SelectItem>
              )}
            </For>
          </SelectContent>
        </SelectRoot>
      );
    }

    case "number": {
      const parts = [
        editable.min !== undefined ? `Min: ${editable.min}` : null,
        editable.max !== undefined ? `Max: ${editable.max}` : null,
      ].filter(Boolean);
      return (
        <>
          {parts.length > 0 && (
            <Field.HelperText fontSize="xs" color="gray.400">
              {parts.join("  ·  ")}
            </Field.HelperText>
          )}
          <NumberInputRoot
            disabled={disabled}
            isInvalid={!!validationError}
            defaultValue={value}
            min={editable.min}
            max={editable.max}
          >
            <NumberInputField onChange={(e) => OnChange(key, parseFloat(e.target.value))} />
          </NumberInputRoot>
        </>
      );
    }

    case "boolean":
      return (
        <Switch
          disabled={disabled}
          defaultChecked={value === true || value === "true" || value === "True"}
          onCheckedChange={(e) => OnChange(key, e.checked)}
        />
      );

    case "color":
      return (
        <DColorPicker
          isDisabled={disabled}
          isInvalid={!!validationError}
          initColor={value}
          onValueChange={(v) => OnChange(key, v)}
        />
      );

    case "image": {
      const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value ?? "");
      return (
        <>
          {value && (
            <ResourceImage
              id={isGuid ? value : undefined}
              resourceKey={isGuid ? undefined : value}
              boxSize="300px"
              objectFit="contain"
              borderRadius="md"
              mb={2}
            />
          )}
          <MaterialChooser
            isDisabled={disabled}
            additionalFilter={(item) =>
              item.mimeType === "image/jpeg" || item.mimeType === "image/png"
            }
            materialsSelected={value}
            onSelect={(name) => OnChange(key, name && name !== "" ? name : undefined)}
          />
        </>
      );
    }

    case "textarea":
      return (
        <Textarea
          isDisabled={disabled}
          isInvalid={!!validationError}
          defaultValue={value}
          onChange={(e) => OnChange(key, e.target.value)}
        />
      );

    case "iconSelect":
      return (
        <DynamicIconChooser
          isDisabled={disabled}
          iconSelected={value}
          onSelect={(name) => OnChange(key, name)}
        />
      );

    case "materialSelect":
      return (
        <MaterialChooser
          isDisabled={disabled}
          additionalFilter={editable.additionalFilter}
          multipleSelection={editable.multiple}
          materialsSelected={value}
          onSelect={(name) => OnChange(key, name)}
        />
      );    case "playerSelect":
      return (
        <PlayerChooser
          isDisabled={disabled}
          selectedPlayers={value ? [value] : []}
          onSelect={([name]) => OnChange(key, name)}
        />
      );

    case "custom":
      return editable.customComponent ? editable.customComponent(key, { [key]: value }, OnChange) : null;

    default:
      return null;
  }
};

// ─── Main panel ────────────────────────────────────────────────────────────────

export const SettingsPanel = ({
  dto,
  editableKeyLabelDict,
  onSave,
  onValidation,
  hideSaveButton,
  saveOnLeave,
  withExport,
  showSearch,
}) => {
  const [updatedDto, setUpdatedDto] = React.useState({});
  const [validationDict, setValidationDict] = React.useState({});
  const [search, setSearch] = React.useState("");

  // Ref so event-handlers always see the latest updatedDto without stale closures
  const updatedDtoRef = React.useRef(updatedDto);
  updatedDtoRef.current = updatedDto;

  if (!editableKeyLabelDict) {
    return <Text color="red.400">MISSING editableKeyLabelDict</Text>;
  }

  // ── handlers ──────────────────────────────────────────────────────────────

  const OnChange = (key, value) => {
    const next = { ...updatedDtoRef.current, [key]: value };
    setUpdatedDto(next);
    if (saveOnLeave) validateAndSave(next);
  };

  const validate = (current = updatedDtoRef.current) => {
    const errors = {};
    const combined = { ...dto, ...current };

    editableKeyLabelDict.forEach((editable) => {
      const { key } = editable;
      if (editable.required && (!combined[key] || combined[key] === "")) {
        errors[key] = "This field is required.";
        return;
      }
      if (editable.validate) {
        const { success, message } = editable.validate(current[key], combined);
        if (!success) errors[key] = message;
      }
    });

    setValidationDict(errors);
    const isValid = Object.keys(errors).length === 0;
    onValidation?.(isValid, current, errors);
    return isValid;
  };

  const validateAndSave = (dtoToSave = updatedDtoRef.current) => {
    if (!validate(dtoToSave)) return;
    onSave?.(dtoToSave);
  };

  // ── render helpers ────────────────────────────────────────────────────────

  if (!dto) return null;

  const combinedDto = { ...dto, ...updatedDto };

  const filteredEditables = editableKeyLabelDict.filter(
    (editable) =>
      search === "" || editable.label.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filteredEditables.reduce((acc, e) => {
    const k = e.category ?? "default";
    (acc[k] ??= []).push(e);
    return acc;
  }, {});
  const defaultItems = grouped["default"] ?? [];
  const namedGroups = Object.entries(grouped).filter(([k]) => k !== "default");

  const renderField = (editable) => {
    const { key } = editable;
    const value = combinedDto[key];
    const validationError = validationDict[key];
    const disabled = !!(editable.disableOn && editable.disableOn(combinedDto));

    return (
      <SettingFieldCard
        key={`${combinedDto.id}_${key}_${disabled}`}
        fieldKey={key}
        editable={editable}
        disabled={disabled}
        validationError={validationError}
      >
        {buildInput(editable, key, value, validationError, disabled, OnChange)}
      </SettingFieldCard>
    );
  };

  // ── jsx ───────────────────────────────────────────────────────────────────

  return (
    <BasePanel>
      <Flex overflowY="auto" overflowX="hidden" direction="column" flex="1" width="100%" pb={2} gap={1}>

        {showSearch && (
          <Box px={2} pt={2}>
            <SearchInput value={search} onChange={setSearch} />
          </Box>
        )}

        {/* Ungrouped fields */}
        {defaultItems.map(renderField)}

        {/* Named category groups */}
        {namedGroups.map(([groupName, items]) => (
          <Stack key={groupName} gap={0} mt={2}>
            <HStack px={3} py={1} gap={2}>
              <Heading size="sm" color="gray.300" whiteSpace="nowrap">
                {groupName}
              </Heading>
              <Separator flex="1" borderColor="whiteAlpha.200" />
            </HStack>
            {items.map(renderField)}
          </Stack>
        ))}
      </Flex>

      {/* Footer bar */}
      {!hideSaveButton && (
        <Box borderTop="1px solid" borderColor="whiteAlpha.100" pt={2} px={2}>
          {Object.keys(validationDict).length > 0 && (
            <Text fontSize="xs" color="red.400" mb={2}>
              Please fix the errors above before saving.
            </Text>
          )}
          <HStack gap={2} mb={2}>
            <Button size="sm" variant="outline" onClick={() => validateAndSave()}>
              Save
            </Button>
            {withExport && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (!validate()) return;
                  const blob = new Blob(
                    [JSON.stringify({ ...dto, ...updatedDto })],
                    { type: "text/plain" }
                  );
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = (dto.name ?? "export").replaceAll(" ", "_") + ".json";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
              >
                Export
              </Button>
            )}
          </HStack>
        </Box>
      )}
    </BasePanel>
  );
};

export default SettingsPanel;
