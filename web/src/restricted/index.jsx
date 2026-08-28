import { createRoot } from "react-dom/client";
import { RestrictedTripApp } from "./RestrictedTripApp.jsx";

const root = document.getElementById("root");
if (root) createRoot(root).render(<RestrictedTripApp />);
