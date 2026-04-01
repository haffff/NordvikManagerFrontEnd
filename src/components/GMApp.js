import { useState, useEffect } from "react";
import { LoginPanel } from "./auth/LoginPanel";
import { MainApp } from "./MainApp";
import WebHelper from "../helpers/WebHelper";
import UtilityHelper from "../helpers/UtilityHelper";
import { RegisterForm } from "./gameLobby/RegisterForm";
import { toaster } from "./ui/toaster";

export const GMApp = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [inviteCode] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("code");
  });

  useEffect(() => {
    WebHelper.getNoResp(
      "user/checklogin",
      () => { setLoggedIn(true); setIsCheckingAuth(false); },
      () => { setLoggedIn(false); setIsCheckingAuth(false); },
      () => {
        setLoggedIn(false);
        setIsCheckingAuth(false);
        toaster.create(UtilityHelper.GenerateConnectionErrorToast());
      }
    );
  }, []);

  if (isCheckingAuth) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        Loading...
      </div>
    );
  }

  if (inviteCode) return <RegisterForm code={inviteCode} />;
  if (loggedIn) return <MainApp />;
  return <LoginPanel OnSuccess={() => setLoggedIn(true)} />;
};

export default GMApp;
