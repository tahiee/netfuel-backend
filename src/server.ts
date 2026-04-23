if (__dirname.includes("dist")) {
  require("module-alias/register");
}

import { config } from "dotenv";
import express from "express";
import morgan from "morgan";
import path from "path";
import { createServer } from "http";
import { env } from "@/utils/env.util";
import { logger } from "@/utils/logger.util";
import { createCorsMiddleware } from "@/middlewares/cors.middleware";
import { securityHeaders } from "@/middlewares/security.middleware";
import { jsonBody, urlEncodedBody } from "@/middlewares/body-parser.middleware";
import { requestId } from "@/middlewares/request-id.middleware";
import { errorHandler } from "@/middlewares/error.middleware";
import { notFound } from "@/middlewares/not-found.middleware";
import healthRoutes from "@/routes/health.routes";
import authRoutes from "@/routes/auth.routes";
import userRoutes from "@/routes/user.routes";

config();

const app = express();
const httpServer = createServer(app);
const port = Number(env.PORT) || Number(process.env.PORT) || 4000;
const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.RAILWAY_ENVIRONMENT === "production" ||
  !!process.env.RAILWAY_PROJECT_ID;

app.disable("x-powered-by");
app.use(requestId);
app.use(securityHeaders);
app.use(createCorsMiddleware());
app.use(morgan(isProduction ? "combined" : "dev"));

// Serve static assets (landing page, favicon, css, js) from /public
// `process.cwd()` resolves to the project root in both dev (ts-node) and prod (dist/).
const publicDir = path.join(process.cwd(), "public");
app.use(
  express.static(publicDir, {
    index: false, // we serve index.html explicitly on "/" so other mounts aren't shadowed
    maxAge: isProduction ? "1h" : 0,
  })
);

// Landing page — status dashboard for the backend
app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// IMPORTANT: better-auth parses the raw request body itself.
// Mount it BEFORE json/urlencoded body parsers so they don't consume the stream.
app.use("/api/auth", authRoutes);

// JSON/urlencoded parsers apply to all other routes below
app.use(jsonBody);
app.use(urlEncodedBody);

app.use("/api", healthRoutes);
app.use("/api/users", userRoutes);

app.use(notFound);
app.use(errorHandler);

httpServer.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
});
