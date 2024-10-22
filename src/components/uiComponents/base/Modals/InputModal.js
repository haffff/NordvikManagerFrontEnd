import * as React from 'react';
import SettingsPanel from '../../../game/settings/SettingsPanel';
import { Button, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, useDisclosure } from '@chakra-ui/react';

export const InputModal = ({ getConfigDict, openRef, onCloseModal, title }) => {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [_dto, _setDto] = React.useState({});
    const [validationSuccess, setValidationSuccess] = React.useState(true);
    const [editableKeyLabelDict, setEditableKeyLabelDict] = React.useState([]);

    const _dtoRef = React.useRef();
    _dtoRef.current = _dto;
    openRef.current = (inputDto) => {
        _setDto(inputDto || {});
        let configDict = getConfigDict();
        setEditableKeyLabelDict(configDict);
        onOpen();
    };

    const validationChange = (result, dto, dictionary) => {
        setValidationSuccess(result);
    }

    return (
        <Modal blockScrollOnMount={false} isOpen={isOpen} onClose={onClose}>
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>{title}</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <SettingsPanel dto={_dtoRef.current} onSave={(dto) => {
                        _setDto({ ..._dtoRef.current, ...dto });
                    }} 
                    onValidation={validationChange}
                    editableKeyLabelDict={editableKeyLabelDict} hideSaveButton saveOnLeave />
                </ModalBody>
                <ModalFooter>
                    <Button colorScheme='blue' mr={3} onClick={(e) => {
                        if (!validationSuccess) return;
                        onCloseModal(_dtoRef.current, true);
                        onClose(e);
                    }}>
                        Save
                    </Button>
                    <Button onClick={(e) => {
                        onCloseModal(_dtoRef.current, false); onClose(e);
                    }}>
                        Cancel
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
export default InputModal;