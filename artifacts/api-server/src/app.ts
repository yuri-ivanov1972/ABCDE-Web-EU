import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const REDIRECT_DOMAINS = ["nutri-score.lv", "nutriscore.lv"];
const NUTRI_SCORE_INFO_URL = "https://abcde.lv/lv/about-nutriscore";
const WWW_DOMAIN = "www.abcde.lv";
const CANONICAL_ORIGIN = "https://abcde.lv";

const app: Express = express();

// 301-redirect alternate domains to the canonical domain
app.use((req, res, next) => {
  if (REDIRECT_DOMAINS.includes(req.hostname)) {
    res.redirect(301, NUTRI_SCORE_INFO_URL);
    return;
  }
  if (req.hostname === WWW_DOMAIN) {
    res.redirect(301, `${CANONICAL_ORIGIN}${req.originalUrl}`);
    return;
  }
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// These optional AI discovery manifests are not published by this site.
// Return a real 404 instead of letting the frontend serve index.html as JSON.
app.get(
  ["/.well-known/ai-catalog.json", "/.well-known/ard.json", "/ai-catalog.json"],
  (_req, res) => {
    res.set("Cache-Control", "public, max-age=300");
    res.status(404).type("text/plain").send("Not Found\n");
  },
);

app.use("/api", router);

export default app;
