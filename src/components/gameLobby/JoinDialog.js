import * as React from 'react';
import { Stack, Heading, Input, InputGroup, InputRightElement, Button, Modal, ModalBody, useDisclosure, ModalHeader, ModalOverlay, ModalContent, useToast } from '@chakra-ui/react'
import WebHelper from '../../helpers/WebHelper';
import UtilityHelper from '../../helpers/UtilityHelper';

export const JoinDialog = ({ OnSuccess }) => {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [showPassword, setShowPassword] = React.useState(false);
    const [error, setError] = React.useState(false);
    const toast = useToast();
    const [createForm, setCreateForm] = React.useState({ password:""});
    const onFormSubmit = (customObj) => {
        let sendForm = customObj || createForm;
        
        WebHelper.post("gamelist/join", customObj || createForm, 
        (playerId) => 
        { 
            OnSuccess(sendForm.gameID);  
            onClose(); 
            window.history.pushState(document.title, document.title, window.origin );
        }, (result) => { setError(true); toast(UtilityHelper.GenerateJoinProblemToast());})
    }

    let params = new URLSearchParams(document.location.search);
    let inviteId = params.get("iid");
    let requirePassword = params.get("rp");

    if(inviteId && !isOpen && !error)
    {
        if(requirePassword)
        {
            setCreateForm({ ...createForm, gameID: inviteId });
            onOpen();
        }
        else
        {
            onFormSubmit({ gameID: inviteId });
        }
    }

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Join game</ModalHeader>
                    <ModalBody>
                        <form onSubmit={() => { }} style={{ width: '400px', margin: '0 auto', marginTop: '50px' }}>
                            <Stack spacing={4} borderColor={error ? "tomato" : "gray.200"}>
                                <Heading as="h6" size="xs">Password</Heading>
                                <InputGroup size="md">
                                    <Input
                                        pr="4.5rem"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter password"
                                        onInput={(input) => setCreateForm({ ...createForm, password: input.target.value })}
                                        borderColor={error ? "tomato" : "gray.200"}
                                    />
                                    <InputRightElement width="4.5rem">
                                        <Button h="1.75rem" size="sm" onClick={() => setShowPassword(!showPassword)}>
                                            {showPassword ? "Hide" : "Show"}
                                        </Button>
                                    </InputRightElement>
                                </InputGroup>
                                <Button onClick={() => onFormSubmit()}>
                                    Join
                                </Button>
                            </Stack>
                        </form>
                    </ModalBody>
                </ModalContent>
            </Modal>
        </>
    )
}
export default JoinDialog;