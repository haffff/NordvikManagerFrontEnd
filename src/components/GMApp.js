import { useState, useEffect } from "react";
import { LoginPanel } from "./auth/LoginPanel";
import { MainApp } from "./MainApp";
import WebHelper from "../helpers/WebHelper";
import TokenStore from "../helpers/TokenStore";
import UtilityHelper from "../helpers/UtilityHelper";
import { RegisterForm } from "./gameLobby/RegisterForm";
import { toaster } from "./ui/toaster";
import CentralSettings from "./CentralSettings";

export const GMApp = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isInvitationRequired, setIsInvitationRequired] = useState(true);
  const [showRegister, setShowRegister] = useState(false);

  const [inviteCode] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("code");
  });

  useEffect(() => {
    WebHelper.getAsync("meta").then((meta) => {
      if (meta?.isInvitationRequired !== undefined) {
        setIsInvitationRequired(meta.isInvitationRequired);
        CentralSettings.loadMeta(meta);
      }
    });

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

  if (inviteCode) return <RegisterForm code={inviteCode} requiresCode={true} />;
  if (loggedIn) return <MainApp onAuthRequired={() => { TokenStore.clear(); setLoggedIn(false); }} />;
  if (showRegister) return <RegisterForm requiresCode={isInvitationRequired} onBack={() => setShowRegister(false)} />;
  return <LoginPanel OnSuccess={() => setLoggedIn(true)} onRegister={() => setShowRegister(true)} />;
};

export default GMApp;
