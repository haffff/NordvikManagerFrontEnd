import React from "react";
import { GMApp } from "./components/GMApp";
import { PlayerApp } from "./components/PlayerApp";
import { Provider } from "./components/ui/provider";
import { Toaster } from "./components/ui/toaster";
import ImportDropPrompt from "./components/uiComponents/ImportDropPrompt";

const IS_PLAYER_MODE = process.env.REACT_APP_MODE === 'player';

// Only demo builds include the demo (the condition is fixed at build time).
const DemoApp = process.env.REACT_APP_MODE === 'demo' ? React.lazy(() => import("./demo/DemoApp")) : null;

function App() {
  return (
    <Provider cssVarsRoot={"#NordvikManagerMain"}>
      {DemoApp
        ? <React.Suspense fallback={null}><DemoApp /></React.Suspense>
        : IS_PLAYER_MODE ? <PlayerApp /> : <GMApp />}
      <Toaster />
      <ImportDropPrompt />
    </Provider>
  );
}

export default App;
