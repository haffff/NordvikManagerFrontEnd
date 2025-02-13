import { useState } from "react";
import { LoginPanel } from "./components/auth/LoginPanel";
import { MainApp } from "./components/MainApp";
import { Provider } from "./components/ui/provider"
import WebHelper from "./helpers/WebHelper";
import UtilityHelper from "./helpers/UtilityHelper";
import { RegisterForm } from "./components/gameLobby/RegisterForm";
import { Toaster, toaster } from "./components/ui/toaster";

function App() {
  const [loggedIn, setLoggedIn] = useState(false);

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
        toaster.create(UtilityHelper.GenerateConnectionErrorToast());
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
    <Provider cssVarsRoot={"#NordvikManagerMain"}>
      {content}
      <Toaster />
    </Provider>
  );
}

export default App;
