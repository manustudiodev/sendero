import { createRoot } from "react-dom/client";
import { UiLocaleProvider } from "../i18n/LanguageSelector.jsx";
import { InviteApp } from "./InviteApp.jsx";

const root = document.getElementById("root");
if (root) createRoot(root).render(<UiLocaleProvider><InviteApp /></UiLocaleProvider>);
