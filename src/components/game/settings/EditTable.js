import * as React from "react";
import {
  Flex,
  Input,
  Checkbox,
  Image,
  Table,
  Tr,
  Td,
  Select,
} from "@chakra-ui/react";
import WebHelper from "../../../helpers/WebHelper";
import BasePanel from "../../uiComponents/base/BasePanel";
import DButtonHorizontalContainer from "../../uiComponents/base/Containers/DButtonHorizontalContainer";
import DropDownButton from "../../uiComponents/base/DDItems/DropDrownButton";
import { NumberInputRoot, NumberInputField } from "../../ui/number-input";
import { DColorPicker } from "../../uiComponents/settingsComponents/ColorPicker";

export const EditTable = ({
  keyBase,
  dto,
  editableKeyLabelDict,
  onSave,
  gameDataManagerRef,
  hideSaveButton,
  saveOnLeave,
}) => {
  const [updatedDto, setUpdatedDto] = React.useState({});
  const [validationDict, setValidationDict] = React.useState({});

  const updateDtoRef = React.useRef(updatedDto);
  updateDtoRef.current = updatedDto;

  if (editableKeyLabelDict === undefined) {
    return <>{"MISSING editableKeyLabelDict"}</>;
  }

  const OnChange = (key, value) => {
    let newDto = { ...updatedDto };
    newDto[key] = value;
    setUpdatedDto(newDto);
    if (saveOnLeave) {
      validateAndSave(newDto);
    }
  };

  const validateAndSave = (updatedDto) => {
    const validationResult = {};
    editableKeyLabelDict.forEach((editable) => {
      if (editable.validate) {
        const { success, message } = editable.validate(
          updatedDto[editable.key],
          updatedDto
        );
        if (!success) {
          validationResult[editable.key] = message;
          return;
        }
      }
    });

    if (Object.keys(validationResult).length > 0) {
      setValidationDict(validationResult);
      return false;
    }

    onSave(updatedDto);
  };

  const HandleDrop = (ev, key) => {
    if (ev.dataTransfer.items && ev.dataTransfer.items.length === 1) {
      let item = [...ev.dataTransfer.items][0];
      if (item.kind === "file") {
        WebHelper.postImage(
          item.getAsFile(),
          gameDataManagerRef.current.Game.id,
          (result) => {
            OnChange(key, WebHelper.getResourceString(result));
          }
        );
      }
    }
  };

  const PrepareItems = () => {
    let mappedElements = [];
    if (dto === undefined) {
      return [];
    }

    editableKeyLabelDict.forEach((editable) => {
      let element = { category: editable.category || "default" };
      const key = editable.key;
      switch (editable.type) {
        case "string":
          element.value = (
            <Table.Row key={keyBase + editable.key}>
              <Table.Cell>{editable.label}</Table.Cell>
              <Table.Cell>
                <Input
                  isInvalid={validationDict[key]}
                  size={"xs"}
                  defaultValue={dto[editable.key]}
                  onChange={(e) => OnChange(editable.key, e.target.value)}
                />
              </Table.Cell>
            </Table.Row>
          );
          break;
        case "select":
          element.value = (
            <Table.Row key={keyBase + editable.key}>
              <Table.Cell>{editable.label}</Table.Cell>
              <Table.Cell>
                <Select
                  isInvalid={validationDict[key]}
                  size={"xs"}
                  defaultValue={dto[editable.key]}
                  onChange={(e) => OnChange(editable.key, e.target.value)}
                >
                  {editable.options.map((option, index) => (
                    <option key={index} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Table.Cell>
            </Table.Row>
          );
          break;
        case "number":
          let infoAboutMinimumMaximum = "";
          if (editable.min || editable.max) {
            infoAboutMinimumMaximum += "(";
            if (editable.min)
              infoAboutMinimumMaximum += ` Minimum: ${editable.min} `;
            if (editable.max)
              infoAboutMinimumMaximum += ` Maximum: ${editable.max} `;
            infoAboutMinimumMaximum += ")";
          }

          element.value = (
            <Table.Row key={keyBase + editable.key}>
              <Table.Cell>
                {editable.label} {infoAboutMinimumMaximum}
              </Table.Cell>
              <Table.Cell>
                <NumberInputRoot
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
              </Table.Cell>
            </Table.Row>
          );
          break;
        case "boolean":
          element.value = (
            <Table.Row key={keyBase + editable.key}>
              <Table.Cell>{editable.label}</Table.Cell>
              <Table.Cell>
                <Checkbox
                  isInvalid={validationDict[key]}
                  defaultChecked={dto[key]}
                  onChange={(element) => OnChange(key, element.target.checked)}
                ></Checkbox>
              </Table.Cell>
            </Table.Row>
          );
          break;
        case "color":
          element.value = (
            <Table.Row key={keyBase + editable.key}>
              <Table.Cell>{editable.label}</Table.Cell>
              <Table.Cell>
                <DColorPicker
                  isInvalid={validationDict[key]}
                  initColor={dto[key]}
                  onValueChange={(element) => OnChange(key, element)}
                />
              </Table.Cell>
            </Table.Row>
          );
          break;
        case "image":
          element.value = (
            <Table.Row key={keyBase + editable.key}>
              <Table.Cell>{editable.label} (You can drag & drop)</Table.Cell>
              <Table.Cell onDrop={(e) => HandleDrop(e, key)}>
                <Image src={dto[key]} boxSize="300px" objectFit={"contain"} />
                {updatedDto[key] ? (
                  <>
                    Preview:
                    <Image
                      src={updatedDto[key]}
                      boxSize="150px"
                      objectFit={"contain"}
                    />
                  </>
                ) : (
                  <></>
                )}
                <Input
                  size={"xs"}
                  defaultValue={dto[key]}
                  onChange={(element) => OnChange(key, element.target.value)}
                ></Input>
              </Table.Cell>
            </Table.Row>
          );
          break;
        default:
          break;
      }
      if (element !== undefined) {
        mappedElements.push(element);
      }
    });
    return mappedElements;
  };

  // const groupBy = function groupBy(list, keyGetter) {
  //     const map = new Map();
  //     list.forEach((item) => {
  //         const key = keyGetter(item);
  //         const collection = map.get(key);
  //         if (!collection) {
  //             map.set(key, [item]);
  //         } else {
  //             collection.push(item);
  //         }
  //     });
  //     return map;
  // }

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
        <Table size={"xs"} variant="simple">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Name</Table.ColumnHeader>
              <Table.ColumnHeader>Value</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>{groupless}</Table.Body>
        </Table>
      </Flex>
      {!hideSaveButton ? (
        <DButtonHorizontalContainer>
          <DropDownButton
            width={200}
            name={"Save"}
            onClick={() => validateAndSave(updatedDto)}
          />
        </DButtonHorizontalContainer>
      ) : (
        <></>
      )}
    </BasePanel>
  );
};

export default EditTable;
