import React from "react";
import { createRoot } from "react-dom/client";
import { UiLocaleProvider } from "../i18n/LanguageSelector.jsx";
import { LandingApp } from "./LandingApp.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <UiLocaleProvider><LandingApp /></UiLocaleProvider>
  </React.StrictMode>,
);
