import React from "react";
import { createRoot } from "react-dom/client";
import { UiLocaleProvider } from "../i18n/LanguageSelector.jsx";
import { PublicShareApp } from "./PublicShareApp.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <UiLocaleProvider><PublicShareApp /></UiLocaleProvider>
  </React.StrictMode>,
);
