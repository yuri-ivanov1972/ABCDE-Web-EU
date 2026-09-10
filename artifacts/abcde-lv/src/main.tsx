import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";
import "./i18n"; // Initialize i18n

// Fallback for alternate-domain requests if the early index.html redirect is
// ever removed or bypassed.
const REDIRECT_DOMAINS = ["nutri-score.lv", "nutriscore.lv"];
if (REDIRECT_DOMAINS.includes(window.location.hostname)) {
  window.location.replace("https://abcde.lv/lv/about-nutriscore");
} else {
  createRoot(document.getElementById("root")!).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );
}
