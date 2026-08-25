import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";

// Use a hash-based SPA route so Vercel never reloads the application when
// navigating to /payments. This keeps the existing localStorage auth session
// and also makes direct payment-page navigation reliable on Vercel.
createRoot(document.getElementById("root")).render(
  <HashRouter>
    <App />
  </HashRouter>
);
