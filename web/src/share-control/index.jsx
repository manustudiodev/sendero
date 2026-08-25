import React from "react";
import { createRoot } from "react-dom/client";
import { PublicShareControlApp } from "./PublicShareControlApp.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PublicShareControlApp />
  </React.StrictMode>,
);
