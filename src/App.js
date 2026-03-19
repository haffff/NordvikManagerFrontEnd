import { useState, useEffect } from "react";
import { LoginPanel } from "./components/auth/LoginPanel";
import { MainApp } from "./components/MainApp";
import { Provider } from "./components/ui/provider"
import WebHelper from "./helpers/WebHelper";
import UtilityHelper from "./helpers/UtilityHelper";
import { RegisterForm } from "./components/gameLobby/RegisterForm";
import { Toaster, toaster } from "./components/ui/toaster";

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [inviteCode] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("code");
  });

  useEffect(() => {
    WebHelper.getNoResp(
      "user/checklogin",
      () => {
        setLoggedIn(true);
        setIsCheckingAuth(false);
      },
      () => {
        setLoggedIn(false);
        setIsCheckingAuth(false);
      },
      () => {
        setLoggedIn(false);
        setIsCheckingAuth(false);
        toaster.create(UtilityHelper.GenerateConnectionErrorToast());
      }
    );
  }, []);
  if (isCheckingAuth) {
    return (
      <Provider cssVarsRoot={"#NordvikManagerMain"}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          Loading...
        </div>
        <Toaster />
      </Provider>
    );
  }

  let content;
  if (inviteCode) {
    content = <RegisterForm code={inviteCode} />;
  } else if (loggedIn) {
    content = <MainApp />;
  } else {
    content = <LoginPanel OnSuccess={() => setLoggedIn(true)} />;
  }
  return (
    <Provider cssVarsRoot={"#NordvikManagerMain"}>
      {content}
      <Toaster />
    </Provider>
  );
}

export default App;
