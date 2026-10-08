// Import React's strict mode tool to catch potential programming issues during development
import { StrictMode } from "react";
// Import the React DOM rendering engine for the web browser
import { createRoot } from "react-dom/client";
// Import our main App component which serves as the controller of the dashboard
import App from "./App";
// Import our stylesheet to apply modern dark glassmorphic styling globally
import "./index.css";

// Find the HTML element in public/index.html with id="root", initialize React on it,
// and render our App component within a StrictMode wrapper for dev diagnostics.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
