import React from "react";
import { GMApp } from "./components/GMApp";
import { PlayerApp } from "./components/PlayerApp";
import { Provider } from "./components/ui/provider";
import { Toaster } from "./components/ui/toaster";
import ImportDropPrompt from "./components/uiComponents/ImportDropPrompt";
import ImportCodePrompt from "./components/uiComponents/ImportCodePrompt";

const IS_PLAYER_MODE = process.env.REACT_APP_MODE === 'player';

// Only demo builds include the demo (the condition is fixed at build time).
const DemoApp = process.env.REACT_APP_MODE === 'demo' ? React.lazy(() => import("./demo/DemoApp")) : null;
// Only the token editor's build includes it (/client/tokens/, no game).
const TokenToolApp = process.env.REACT_APP_MODE === 'tokens' ? React.lazy(() => import("./tokenTool/TokenToolApp")) : null;

function App() {
  return (
    <Provider cssVarsRoot={"#NordvikManagerMain"}>
      {TokenToolApp
        ? <React.Suspense fallback={null}><TokenToolApp /></React.Suspense>
        : DemoApp
        ? <React.Suspense fallback={null}><DemoApp /></React.Suspense>
        : IS_PLAYER_MODE ? <PlayerApp /> : <GMApp />}
      <Toaster />
      <ImportDropPrompt />
      <ImportCodePrompt />
    </Provider>
  );
}

export default App;
