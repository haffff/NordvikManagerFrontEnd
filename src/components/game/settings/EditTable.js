import * as React from 'react';
import { Flex, FormLabel, Input, Checkbox, NumberInput, NumberInputField, Image, TableContainer, Table, Thead, Tr, Th, Tbody, Td, Select } from '@chakra-ui/react'
import ColorPicker from '../../uiComponents/ColorPicker';
import WebHelper from '../../../helpers/WebHelper';
import BasePanel from '../../uiComponents/base/BasePanel';
import DButtonHorizontalContainer from '../../uiComponents/base/Containers/DButtonHorizontalContainer';
import DropDownButton from '../../uiComponents/base/DDItems/DropDrownButton';

export const EditTable = ({ keyBase, dto, editableKeyLabelDict, onSave, gameDataManagerRef, hideSaveButton, saveOnLeave }) => {
    const [updatedDto, setUpdatedDto] = React.useState({});
    const [validationDict, setValidationDict] = React.useState({});

    const updateDtoRef = React.useRef(updatedDto);
    updateDtoRef.current = updatedDto;

    if (editableKeyLabelDict === undefined) {
        return (<>{'MISSING editableKeyLabelDict'}</>);
    }

    const OnChange = (key, value) => {
        let newDto = { ...updatedDto };
        newDto[key] = value;
        setUpdatedDto(newDto);
        if(saveOnLeave)
        {
            validateAndSave(newDto);
        }
    }

    const validateAndSave = (updatedDto) => {
        const validationResult = {};
        editableKeyLabelDict.forEach(editable => {
            if (editable.validate) {
                const { success, message } = editable.validate(updatedDto[editable.key], updatedDto);
                if (!success) {
                    validationResult[editable.key] = message;
                    return;
                }
            }
        });

        if(Object.keys(validationResult).length > 0)
        {
            setValidationDict(validationResult);
            return false;
        }

        onSave(updatedDto);
    }

    const HandleDrop = (ev, key) => {
        if (ev.dataTransfer.items && ev.dataTransfer.items.length === 1) {
            let item = [...ev.dataTransfer.items][0];
            if (item.kind === "file") {
                WebHelper.postImage(item.getAsFile(), gameDataManagerRef.current.Game.id, (result) => {
                    OnChange(key, `${WebHelper.ApiAddress}/Materials/Resource?gameid=${gameDataManagerRef.current.Game.id}&id=${result.id}`);
                });
            }
        }
    }


    const PrepareItems = () => {
        let mappedElements = [];
        if (dto === undefined) {
            return [];
        }

        editableKeyLabelDict.forEach(editable => {
            let element = { category: editable.category || "default" };
            const key = editable.key;
            switch (editable.type) {
                case "string":
                    element.value = (
                        <Tr key={keyBase + editable.key}>
                            <Td>{editable.label}</Td>
                            <Td><Input isInvalid={validationDict[key]} size={'xs'} defaultValue={dto[editable.key]} onChange={(e) => OnChange(editable.key, e.target.value)} /></Td>
                        </Tr>
                    );
                    break;
                case "select":
                    element.value = (
                        <Tr key={keyBase + editable.key}>
                            <Td>{editable.label}</Td>
                            <Td><Select isInvalid={validationDict[key]} size={'xs'} defaultValue={dto[editable.key]} onChange={(e) => OnChange(editable.key, e.target.value)}>
                                {editable.options.map((option, index) => <option key={index} value={option.value}>{option.label}</option>)}
                                </Select>
                            </Td>
                        </Tr>
                    );
                    break;
                case "number":
                    let infoAboutMinimumMaximum = '';
                    if (editable.min || editable.max) {
                        infoAboutMinimumMaximum += '(';
                        if (editable.min)
                            infoAboutMinimumMaximum += ` Minimum: ${editable.min} `;
                        if (editable.max)
                            infoAboutMinimumMaximum += ` Maximum: ${editable.max} `;
                        infoAboutMinimumMaximum += ')';
                    }

                    element.value = (
                        <Th key={keyBase + editable.key}>
                            <Td>{editable.label} {infoAboutMinimumMaximum}</Td>
                            <Td>
                                <NumberInput isInvalid={validationDict[key]} defaultValue={dto[key]} min={editable.min} max={editable.max}>
                                    <NumberInputField onChange={(element) => OnChange(key, parseFloat(element.target.value))} />
                                </NumberInput>
                            </Td>
                        </Th>
                    );
                    break;
                case "boolean":
                    element.value = (
                        <Tr key={keyBase + editable.key}>
                            <Td>{editable.label}</Td>
                            <Td>
                                <Checkbox isInvalid={validationDict[key]} defaultChecked={dto[key]} onChange={(element) => OnChange(key, element.target.checked)} ><FormLabel>{`${editable.label}`}</FormLabel></Checkbox>
                            </Td>
                        </Tr>
                    );
                    break;
                case "color":
                    element.value = (
                        <Tr key={keyBase + editable.key}>
                            <Td>{editable.label}</Td>
                            <Td>
                                <ColorPicker isInvalid={validationDict[key]} color={dto[key]} onChange={(element) => OnChange(key, element)} />
                            </Td>
                        </Tr>
                    );
                    break;
                case "image":
                    element.value = (
                        <Tr key={keyBase + editable.key}>
                            <Td>{editable.label} (You can drag & drop)</Td>
                            <Td onDrop={(e) => HandleDrop(e, key)}>
                                <Image src={dto[key]} boxSize='300px' objectFit={'contain'} />
                                {(updatedDto[key]) ?
                                    (
                                        <>
                                            Preview:
                                            <Image src={updatedDto[key]} boxSize='150px' objectFit={'contain'} />
                                        </>
                                    ) : <></>}
                                <Input size={'xs'} defaultValue={dto[key]} onChange={(element) => OnChange(key, element.target.value)}></Input>
                            </Td>
                        </Tr>
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
    }

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
        let grouped = Object.groupBy(mappedItems, x => x.category);
        return grouped["default"] ? grouped["default"].map(x => x.value) : [];
    }


    let mappedItems = PrepareItems();
    let groupless = getGroupless();
    let grouped = Object.groupBy(mappedItems, x => x.category);

    return (
        <BasePanel>
            <Flex overflowY="auto" overflowX="hidden" direction='column' grow='1' width='100%' heigth='100%'>
                <TableContainer>
                    <Table size={'xs'} variant='simple'>
                        <Thead>
                            <Tr>
                                <Th>Name</Th>
                                <Th>Value</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {groupless}
                        </Tbody>
                    </Table>
                </TableContainer>
            </Flex>
            {!hideSaveButton ?
                <DButtonHorizontalContainer>
                    <DropDownButton width={200} name={"Save"} onClick={() => validateAndSave(updatedDto)} />
                </DButtonHorizontalContainer> : <></>}
        </BasePanel>
    );
}

export default EditTable; 