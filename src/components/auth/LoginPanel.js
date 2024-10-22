import * as React from 'react';
import { Stack, Heading, Input, InputGroup, InputRightElement, Button, useToast } from '@chakra-ui/react'
import WebHelper from '../../helpers/WebHelper';
import UtilityHelper from '../../helpers/UtilityHelper';

export const LoginPanel = ({ OnSuccess }) => {
    const toast = useToast();
    const [isLogging, setisLogging] = React.useState(false);
    const [error, setError] = React.useState(false);
    const [loginForm, setLoginForm] = React.useState({});
    const onFormSubmit = () => {
        WebHelper.post("User/login", 
        loginForm, 
        (result) => 
        {
            OnSuccess();
        }, 
        (result) => { setError(true)}, 
        () => {toast(UtilityHelper.GenerateConnectionErrorToast());})
    }

    return (
        <form onKeyUp={e => {if(e.key == "Enter") {onFormSubmit()}}} onSubmit={() => { }} style={{ width: '400px', margin: '0 auto', marginTop: '50px' }}>
            <Stack spacing={4} borderColor={error ? "tomato" : "gray.200"}>
                <Heading as="h6" size="xs">Login</Heading>
                <Input placeholder="Login" size="md" onInput={(input) => setLoginForm({ ...loginForm, UserName: input.target.value })} />
                <Heading as="h6" size="xs">Password</Heading>
                <Input pr="4.5rem" type="password" placeholder="Enter password" onInput={(input) => setLoginForm({ ...loginForm, password: input.target.value })} borderColor={error ? "tomato" : "gray.200"}/>
                <Button isLoading={isLogging} onClick={onFormSubmit}>
                    Login
                </Button>
            </Stack>
        </form>
    )
}
export default LoginPanel;