import React from "react";
import { createRoot } from "react-dom/client";
import { LegalPage } from "./LegalPage.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LegalPage kind="terms" />
  </React.StrictMode>,
);
