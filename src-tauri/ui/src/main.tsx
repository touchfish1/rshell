import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initDocumentThemeFromStorage } from "./lib/appTheme";
import "./styles/app.css";

initDocumentThemeFromStorage();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
