import { useState } from "react";
import { LoginPanel } from "./components/auth/LoginPanel";
import { MainApp } from "./components/MainApp";
import { ChakraProvider, useToast } from "@chakra-ui/react";
import WebHelper from "./helpers/WebHelper";
import UtilityHelper from "./helpers/UtilityHelper";
import { RegisterForm } from "./components/gameLobby/RegisterForm";

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const toast = useToast();

  if (loggedIn !== true) {
    WebHelper.getNoResp(
      "user/checklogin",
      () => {
        setLoggedIn(true);
      },
      () => {
        setLoggedIn(false);
      },
      () => {
        setLoggedIn(false);
        toast(UtilityHelper.GenerateConnectionErrorToast());
      }
    );
  }

  //check if website has inviteCode part
  const urlParams = new URLSearchParams(window.location.search);
  const inviteCode = urlParams.get("code");
  
  let content = <>    </>

  if(inviteCode){
    console.log("Invite code detected: " + inviteCode);

    content = (<RegisterForm code={inviteCode} />);
  }
  else
  {
    if(loggedIn)
    {
      content = (<MainApp />);
    }
    else
    {
      content = (<LoginPanel OnSuccess={() => setLoggedIn(true)} />);
    }
  }

  

  return (
    <ChakraProvider cssVarsRoot={"#NordvikManagerMain"}>
      {content}
    </ChakraProvider>
  );
}

export default App;
