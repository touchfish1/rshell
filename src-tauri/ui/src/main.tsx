import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initAppShellTheme } from "./lib/appTheme";
import "./styles/app.css";

initAppShellTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
