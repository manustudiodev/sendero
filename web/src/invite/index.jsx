import { createRoot } from "react-dom/client";
import { InviteApp } from "./InviteApp.jsx";

const root = document.getElementById("root");
if (root) createRoot(root).render(<InviteApp />);
