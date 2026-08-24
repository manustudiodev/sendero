import React from "react";
import { createRoot } from "react-dom/client";
import { ItineraryApp } from "./ItineraryApp.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode><ItineraryApp /></React.StrictMode>,
);
