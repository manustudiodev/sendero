import { createRoot } from "react-dom/client";
import { UiLocaleProvider } from "../i18n/LanguageSelector.jsx";
import { GenerateTripApp } from "./GenerateTripApp.jsx";

const root = document.getElementById("root");
if (root) createRoot(root).render(<UiLocaleProvider><GenerateTripApp /></UiLocaleProvider>);
