import React from "react";
import { createRoot } from "react-dom/client";
import { TripRequirementsApp } from "./TripRequirementsApp.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode><TripRequirementsApp /></React.StrictMode>,
);
