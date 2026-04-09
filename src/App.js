import { GMApp } from "./components/GMApp";
import { PlayerApp } from "./components/PlayerApp";
import { Provider } from "./components/ui/provider";
import { Toaster } from "./components/ui/toaster";

const IS_PLAYER_MODE = process.env.REACT_APP_MODE === 'player';

function App() {
  return (
    <Provider cssVarsRoot={"#NordvikManagerMain"}>
      {IS_PLAYER_MODE ? <PlayerApp /> : <GMApp />}
      <Toaster />
    </Provider>
  );
}

export default App;
