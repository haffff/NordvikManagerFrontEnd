import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { defaultConfig, createSystem } from "@chakra-ui/react"

const root = ReactDOM.createRoot(document.getElementById("root"));

export const system = createSystem({
  config: {
    useSystemColorMode: false,
    initialColorMode: "dark",
  },
  colors: {
    // gray: {
    //   50: "#F2F2F2",
    //   100: "#DBDBDB",
    //   200: "#C4C4C4",
    //   300: "#ADADAD",
    //   400: "#969696",
    //   500: "#808080",
    //   600: "#666666",
    //   700: "#4D4D4D",
    //   800: "#333333",
    //   900: "#1A1A1A",
    // },
  },
});

root.render(<App />);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
