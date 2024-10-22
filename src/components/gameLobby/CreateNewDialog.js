import * as React from 'react';
import { Stack, Heading, Input, InputGroup, InputRightElement, Button, Modal, ModalBody, useDisclosure, ModalHeader, ModalOverlay, ModalContent, Checkbox } from '@chakra-ui/react'
import WebHelper from '../../helpers/WebHelper';

export const CreateNewDialog = ({ OnSuccess }) => {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [showPassword, setShowPassword] = React.useState(false);
    const [error, setError] = React.useState(false);
    const [createForm, setCreateForm] = React.useState({passwordRequired:false});
    const onFormSubmit = () => {
        WebHelper.post("gamelist/addgame", createForm, (obj) => { OnSuccess(obj); onClose(); }, (result) => { setError(true) })
    }
    
    return (
        <>
            <Button width={'200px'} onClick={onOpen}>Create new one</Button>
            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Create new game</ModalHeader>
                    <ModalBody>
                        <form onSubmit={() => { }} style={{ width: '400px', margin: '0 auto', marginTop: '50px' }}>
                            <Stack spacing={4} borderColor={error ? "tomato" : "gray.200"}>
                                <Heading as="h6" size="xs">Title</Heading>
                                <Input placeholder="My epic adventure" size="md" onInput={(input) => setCreateForm({ ...createForm, Name: input.target.value })} />
                                <Heading as="h6" size="xs" >Password</Heading>
                                <Checkbox defaultChecked={false} onChange={(input) => setCreateForm({ ...createForm, passwordRequired: input.target.checked })}>Require Password</Checkbox>
                                <Input type='password' disabled={!createForm.passwordRequired} placeholder="Enter password" size="md" onInput={(input) => setCreateForm({ ...createForm, Password: input.target.value })} />
                                <Button onClick={onFormSubmit}>
                                    Create
                                </Button>
                            </Stack>
                        </form>
                    </ModalBody>
                </ModalContent>
            </Modal>
        </>
    )
}
export default CreateNewDialog;