import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { prepareIcons } from "./state/scheme";
import "./app.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Once the page has settled, so the icons never compete with the app itself.
if ("requestIdleCallback" in window) requestIdleCallback(prepareIcons);
else setTimeout(prepareIcons, 1000);
