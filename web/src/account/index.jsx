import { createRoot } from "react-dom/client";
import { AccountApp } from "./AccountApp.jsx";

const root = document.getElementById("root");
if (root) createRoot(root).render(<AccountApp />);
