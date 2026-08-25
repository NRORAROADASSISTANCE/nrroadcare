import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";

// Keep the customer -> payment transition inside React Router.
// The old button used window.location.href, which caused a full page reload;
// if /auth/me rejected the existing token during that reload, the UI appeared logged out.
const customerPayCapture = e => {
  const button = e.target?.closest?.("button");
  if (!button || button.textContent?.trim() !== "Pay ₹4,500") return;
  const fiberKey = Object.keys(button).find(k => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
  let fiber = fiberKey ? button[fiberKey] : null;
  while (fiber && fiber.key == null) fiber = fiber.return;
  const customerId = fiber?.key;
  if (customerId == null) return;
  e.preventDefault();
  e.stopPropagation();
  window.history.pushState({}, "", `/payments?customer=${encodeURIComponent(customerId)}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
};
document.addEventListener("click", customerPayCapture, true);

createRoot(document.getElementById("root")).render(<BrowserRouter><App/></BrowserRouter>);
