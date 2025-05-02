import * as React from "react";
import {
  Box,
  Textarea,
  Grid,
  GridItem,
  Flex,
  Card,
  Input,
  Field,
  Accordion,
  Image,
  HStack,
  Button,
  Heading,
  For,
  FieldErrorText,
  createListCollection,
  Stack,
} from "@chakra-ui/react";
import {
  SelectRoot,
  SelectItem,
  SelectValueText,
  SelectContent,
  SelectTrigger,
} from "../../ui/select";
import { Switch } from "../../ui/switch";
import {
  NumberInputField,
  NumberInputRoot,
} from "../../ui/number-input";
import WebHelper from "../../../helpers/WebHelper";
import BasePanel from "../../uiComponents/base/BasePanel";
import DynamicIconChooser from "../../uiComponents/icons/DynamicIconChooser";
import { MaterialChooser } from "../../uiComponents/MaterialChooser";
import { PlayerChooser } from "../../uiComponents/PlayerChooser";
import { SearchInput } from "../../uiComponents/SearchInput";
import { DColorPicker } from "../../uiComponents/settingsComponents/ColorPicker";

export const SettingsPanel = ({
  dto,
  editableKeyLabelDict,
  onSave,
  onValidation,
  hideSaveButton,
  saveOnLeave,
  withExport,
  showSearch
}) => {
  const [updatedDto, setUpdatedDto] = React.useState({});
  const [validationDict, setValidationDict] = React.useState({});
  const [search, setSearch] = React.useState("");

  const updateDtoRef = React.useRef();
  updateDtoRef.current = updatedDto;

  if (editableKeyLabelDict === undefined) {
    return <>{"MISSING editableKeyLabelDict"}</>;
  }

  const OnChange = (key, value) => {
    let newDto = { ...updateDtoRef.current };
    newDto[key] = value;
    setUpdatedDto(newDto);
    if (saveOnLeave) {
      validateAndSave(newDto);
    }
  };

  const validate = () => {
    const validationResult = {};
    editableKeyLabelDict.forEach((editable) => {
      let combinedDto = { ...dto, ...updatedDto };
      if (
        editable.required &&
        (!combinedDto[editable.key] || combinedDto[editable.key] === "")
      ) {
        validationResult[editable.key] = "This field is required.";
        return;
      }
      if (editable.validate) {
        const { success, message } = editable.validate(
          updatedDto[editable.key],
          combinedDto
        );
        if (!success) {
          validationResult[editable.key] = message;
          return;
        }
      }
    });

    setValidationDict(validationResult);

    if (Object.keys(validationResult).length > 0) {
      if (onValidation) onValidation(false, updatedDto, validationResult);
      return false;
    }

    if (onValidation) onValidation(true, updatedDto, validationResult);
    return true;
  };

  const validateAndSave = (updatedDto) => {
    if (validate() === false) return;
    onSave(updatedDto);
  };

  const HandleDrop = (ev, key) => {
    if (ev.dataTransfer.items && ev.dataTransfer.items.length === 1) {
      let item = [...ev.dataTransfer.items][0];
      if (item.kind === "file") {
        WebHelper.postImage(item.getAsFile(), dto.name, (result) => {
          OnChange(key, WebHelper.getResourceString(result));
        });
      }
    }
  };

  const GenerateCardBase = (key, dto, editable, content) => {
    let disabled = editable.disableOn && editable.disableOn(dto);
    return (
      <GridItem
        key={`${dto.id}_${key}_${disabled}`}
      >
        <Card.Root
          style={{ backgroundColor: "rgba(40,40,40,0.5)", color: "white", opacity: disabled ? 0.5 : 1 }}
          colorScheme="blackAlpha"
          variant="outline"
          padding={3}
          pointerEvents={"all"}
          margin={1}
          size="sm"
        >
          <Field.Root
            invalid={validationDict[key]}
            required={editable.required}
          >
            <Field.Label>
              {editable.label}
              <Field.RequiredIndicator />
            </Field.Label>
            <FieldErrorText>
              <Field.ErrorIcon boxSize={"15px"} />
              {validationDict[key]}
            </FieldErrorText>
            {content}
          </Field.Root>
        </Card.Root>
      </GridItem>
    );
  };

  const PrepareItems = () => {
    let mappedElements = [];
    if (dto === undefined) {
      return [];
    }

    dto = { ...dto, ...updatedDto };

    editableKeyLabelDict.forEach((editable) => {
      const key = editable.key;

      //if editable name doesnt match search, skip
      if (
        search !== "" &&
        !editable.label.toLowerCase().includes(search.toLowerCase())
      ) {
        return;
      }

      let element = {
        category:
          editable.category !== undefined ? editable.category : "default",
      };

      let input = <></>;

      switch (editable.type) {
        case "string":
          input = (
            <Input
              label={editable.label}
              disabled={editable.disableOn && editable.disableOn(dto)}
              defaultValue={dto[key]}
              onChange={(element) => OnChange(key, element.target.value)}
            />
          );
          break;
        case "select":
          const collection = createListCollection({ items: editable.options });
          input = (
            <SelectRoot
              disabled={editable.disableOn && editable.disableOn(dto)}
              collection={collection}
              value={[dto[key]]}
              onValueChange={(element) => OnChange(key, element.value[0])}
            >
              <SelectTrigger>
                <SelectValueText placeholder="Select...">
                  {(items) => {
                    const { label } = items.find(
                      (x) => x.value === dto[key]
                    ) || { label: "Select..." };
                    return <>{label}</>;
                  }}
                </SelectValueText>
              </SelectTrigger>
              <SelectContent zIndex={9999}>
                <For each={collection.items}>
                  {(option, index) => (
                    <SelectItem
                      key={index}
                      selected={dto[key] === option.value}
                      item={option}
                    >
                      {option.label}
                    </SelectItem>
                  )}
                </For>
              </SelectContent>
            </SelectRoot>
          );
          break;
        case "number":
          let infoAboutMinimumMaximum = "";
          if (editable.min !== undefined || editable.max !== undefined) {
            infoAboutMinimumMaximum += "(";
            if (editable.min !== undefined)
              infoAboutMinimumMaximum += ` Minimum: ${editable.min} `;
            if (editable.max !== undefined)
              infoAboutMinimumMaximum += ` Maximum: ${editable.max} `;
            infoAboutMinimumMaximum += ")";
          }
          input = (
            <>
              <Field.HelperText>{infoAboutMinimumMaximum}</Field.HelperText>
              <NumberInputRoot
                disabled={editable.disableOn && editable.disableOn(dto)}
                isInvalid={validationDict[key]}
                defaultValue={dto[key]}
                min={editable.min}
                max={editable.max}
              >
                <NumberInputField
                  onChange={(element) =>
                    OnChange(key, parseFloat(element.target.value))
                  }
                />
              </NumberInputRoot>
            </>
          );
          break;
        case "boolean":
          input = (
            <>
              <Switch
              disabled={editable.disableOn && editable.disableOn(dto)}
                defaultChecked={dto[key] == true || dto[key] == "true" || dto[key] == "True"}
                onCheckedChange={(e) => {
                  OnChange(key, e.checked);
                }}
              />
            </>
          );
          break;
        case "color":
          input = (
            <DColorPicker
              isDisabled={editable.disableOn && editable.disableOn(dto)}
              isInvalid={validationDict[key]}
              initColor={dto[key]}
              onValueChange={(element) => OnChange(key, element)}
            />
          );
          break;
        case "image":
          input = (
            <>
              {dto[key] ? (
                <Image
                  src={WebHelper.getResourceString(dto[key])}
                  boxSize="300px"
                  objectFit={"contain"}
                />
              ) : (
                <></>
              )}
              <MaterialChooser
                isDisabled={editable.disableOn && editable.disableOn(dto)}
                additionalFilter={(item) =>
                  item.mimeType == "image/jpeg" || item.mimeType == "image/png"
                }
                materialsSelected={dto[key]}
                onSelect={(name) =>
                  OnChange(key, name && name != "" ? name : undefined)
                }
              />
            </>
          );
          break;
        case "textarea":
          input = (
            <Textarea
              isDisabled={editable.disableOn && editable.disableOn(dto)}
              isInvalid={validationDict[key]}
              defaultValue={dto[key]}
              onChange={(element) => OnChange(key, element.target.value)}
            ></Textarea>
          );
          break;
        case "iconSelect":
          input = (
            <DynamicIconChooser
              isDisabled={editable.disableOn && editable.disableOn(dto)}
              iconSelected={dto[key]}
              onSelect={(name) => OnChange(key, name)}
            />
          );
          break;
        case "materialSelect":
          input = (
            <MaterialChooser
              isDisabled={editable.disableOn && editable.disableOn(dto)}
              additionalFilter={editable.additionalFilter}
              multipleSelection={editable.multiple}
              materialsSelected={dto[key]}
              onSelect={(name) => OnChange(key, name)}
            />
          );
          break;
        case "playerSelect":
          input = (
            <PlayerChooser
              isDisabled={editable.disableOn && editable.disableOn(dto)}
              selectedPlayers={[dto[key]]}
              onSelect={([name]) => OnChange(key, name)}
            />
          );
          break;
        case "custom":
          input = editable.customComponent(key, dto, OnChange);
        default:
          break;
      }

      if (element.value === undefined) {
        element.value = GenerateCardBase(key, dto, editable, input);
      }

      if (element !== undefined) {
        mappedElements.push(element);
      }
    });
    return mappedElements;
  };

  const getGroupless = () => {
    let grouped = Object.groupBy(mappedItems, (x) => x.category);
    return grouped["default"] ? grouped["default"].map((x) => x.value) : [];
  };

  let mappedItems = PrepareItems();
  let groupless = getGroupless();
  let grouped = Object.groupBy(mappedItems, (x) => x.category);

  return (
    <BasePanel>
      <Flex
        overflowY="auto"
        overflowX="hidden"
        direction="column"
        grow="1"
        width="100%"
        heigth="100%"
      >
        {showSearch && (
          <SearchInput value={search} onChange={(v) => setSearch(v)} />
        )}
        {groupless}
        {Object.keys(grouped)
          .filter((x) => x !== "default")
          .map((x) => (
            <Stack>
              <Heading size={"md"} margin={"10px"}>
                {x}
              </Heading>
              {grouped[x].map((y) => y.value)}
            </Stack>
          ))}
      </Flex>
      {hideSaveButton ? (
        <></>
      ) : (
        <>
          {Object.keys(validationDict).length > 0 ? (
            <p style={{ color: "red" }}>
              Settings have errors, please correct them before saving
            </p>
          ) : (
            <></>
          )}
          <HStack margin={"10px"} gap={"10px"}>
            <Button
              variant={"outline"}
              onClick={() => validateAndSave(updatedDto)}
            >
              Save
            </Button>
            {withExport ? (
              <Button
                onClick={() => {
                  if (validate() === false) return;
                  const element = document.createElement("a");
                  const file = new Blob(
                    [JSON.stringify({ ...dto, ...updatedDto })],
                    { type: "text/plain" }
                  );
                  element.href = URL.createObjectURL(file);
                  element.download = dto.name.replaceAll(" ", "_") + ".json";
                  document.body.appendChild(element); // Required for this to work in FireFox
                  element.click();
                }}
              >
                Export
              </Button>
            ) : (
              <></>
            )}
          </HStack>
        </>
      )}
    </BasePanel>
  );
};

export default SettingsPanel;
