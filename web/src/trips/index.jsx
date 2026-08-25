import React from "react";
import { createRoot } from "react-dom/client";
import { TripListApp } from "./TripListApp.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode><TripListApp /></React.StrictMode>,
);
