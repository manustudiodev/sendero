import React from "react";
import { createRoot } from "react-dom/client";
import { PublicShareApp } from "./PublicShareApp.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PublicShareApp />
  </React.StrictMode>,
);
