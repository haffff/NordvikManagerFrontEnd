import { useState, useEffect, useCallback } from 'react';
import { PlayerLoginPanel } from './auth/PlayerLoginPanel';
import { PlayerRegisterForm } from './auth/PlayerRegisterForm';
import { PlayerMainApp } from './PlayerMainApp';
import CentralWebHelper from '../helpers/CentralWebHelper';
import TokenStore from '../helpers/TokenStore';
import UtilityHelper from '../helpers/UtilityHelper';
import { toaster } from './ui/toaster';

export const PlayerApp = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isInvitationRequired, setIsInvitationRequired] = useState(true); // safe default
  const [showRegister, setShowRegister] = useState(false);

  const [inviteCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('code') ?? null;
  });

  const [gameId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('game') ?? null;
  });

  const [requiresPassword] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('rp') === '1';
  });

  useEffect(() => {
    // Fetch server meta (no auth needed) and check login status in parallel
    CentralWebHelper.getAsync('meta').then((meta) => {
      if (meta?.isInvitationRequired !== undefined) {
        setIsInvitationRequired(meta.isInvitationRequired);
      }
    });

    CentralWebHelper.getNoResp(
      'user/checklogin',
      () => { setLoggedIn(true); setIsCheckingAuth(false); },
      () => { setIsCheckingAuth(false); },
      () => {
        setIsCheckingAuth(false);
        toaster.create(UtilityHelper.GenerateConnectionErrorToast());
      }
    );
  }, []);

  const handleAuthRequired = useCallback(() => {
    TokenStore.clear();
    setLoggedIn(false);
  }, []);

  if (isCheckingAuth) {
    return ( 
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        Loading...
      </div>
    );
  }

  if (loggedIn) return <PlayerMainApp autoGameId={gameId} requiresPassword={requiresPassword} onAuthRequired={handleAuthRequired} />;

  // Invite link in URL → always show register form (regardless of isInvitationRequired)
  if (inviteCode) {
    return (
      <PlayerRegisterForm
        code={inviteCode}
        requiresCode={true}
        OnSuccess={() => setLoggedIn(true)}
      />
    );
  }

  if (showRegister) {
    return (
      <PlayerRegisterForm
        requiresCode={isInvitationRequired}
        onBack={() => setShowRegister(false)}
        OnSuccess={() => setLoggedIn(true)}
      />
    );
  }

  return (
    <PlayerLoginPanel
      OnSuccess={() => setLoggedIn(true)}
      onRegister={() => setShowRegister(true)}
    />
  );
};

export default PlayerApp;
