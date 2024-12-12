import { useState } from 'react'
import { LoginPanel } from './components/auth/LoginPanel'
import { MainApp } from './components/MainApp'
import { ChakraProvider, useToast } from '@chakra-ui/react'
import WebHelper from './helpers/WebHelper';
import UtilityHelper from './helpers/UtilityHelper';

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const toast = useToast();

  if (loggedIn !== true) {
    WebHelper.getNoResp("user/checklogin", () => { setLoggedIn(true) }, ()=>{setLoggedIn(false)}, ()=>{
      setLoggedIn(false); 
      toast(UtilityHelper.GenerateConnectionErrorToast());
    });
  }

  return (
    <ChakraProvider cssVarsRoot={'#NordvikManagerMain'}>
        {loggedIn ?
          <MainApp /> :
          <LoginPanel OnSuccess={() => setLoggedIn(true)} />
        }
    </ChakraProvider>
  );
}

export default App;
