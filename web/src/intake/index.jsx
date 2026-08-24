import React from "react";
import { createRoot } from "react-dom/client";
import { TripIntakeApp } from "./TripIntakeApp.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode><TripIntakeApp /></React.StrictMode>,
);
