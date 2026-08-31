import { createRoot } from "react-dom/client";
import { UiLocaleProvider } from "../i18n/LanguageSelector.jsx";
import { AccountApp } from "./AccountApp.jsx";

const root = document.getElementById("root");
if (root) createRoot(root).render(<UiLocaleProvider><AccountApp /></UiLocaleProvider>);
