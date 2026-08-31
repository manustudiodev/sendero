import React from "react";
import { createRoot } from "react-dom/client";
import { UiLocaleProvider } from "../i18n/LanguageSelector.jsx";
import { LegalPage } from "./LegalPage.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <UiLocaleProvider><LegalPage kind="terms" /></UiLocaleProvider>
  </React.StrictMode>,
);
