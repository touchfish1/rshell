import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initAppShellTheme } from "./lib/appTheme";
import { ThemeProvider } from "./theme-context";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles/app.css";

initAppShellTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>
);
