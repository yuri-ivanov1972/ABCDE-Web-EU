import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";
import "./i18n"; // Initialize i18n

// 301-equivalent client-side redirect for alternate domains.
// In production the frontend is static, so this fires before any content
// renders. Google treats consistent JS redirects the same as 301s.
const REDIRECT_DOMAINS = ["nutri-score.lv", "nutriscore.lv"];
if (REDIRECT_DOMAINS.includes(window.location.hostname)) {
  window.location.replace(
    "https://abcde.lv" +
      window.location.pathname +
      window.location.search +
      window.location.hash,
  );
} else {
  createRoot(document.getElementById("root")!).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );
}
