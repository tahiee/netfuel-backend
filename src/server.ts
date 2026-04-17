if (__dirname.includes("dist")) {
  require("module-alias/register");
}

import { config } from "dotenv";
import express from "express";
import morgan from "morgan";
import { createServer } from "http";
import { env } from "@/utils/env.util";
import { logger } from "@/utils/logger.util";
import { createCorsMiddleware } from "@/middlewares/cors.middleware";
import { securityHeaders } from "@/middlewares/security.middleware";
import {
  jsonBody,
  urlEncodedBody,
} from "@/middlewares/body-parser.middleware";
import { requestId } from "@/middlewares/request-id.middleware";
import { errorHandler } from "@/middlewares/error.middleware";
import { notFound } from "@/middlewares/not-found.middleware";
import healthRoutes from "@/routes/health.routes";

config();

const app = express();
const httpServer = createServer(app);
const port = Number(env.PORT) || Number(process.env.PORT) || 3000;
const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.RAILWAY_ENVIRONMENT === "production" ||
  !!process.env.RAILWAY_PROJECT_ID;

app.disable("x-powered-by");
app.use(requestId);
app.use(securityHeaders);
app.use(createCorsMiddleware());
app.use(morgan(isProduction ? "combined" : "dev"));
app.use(jsonBody);
app.use(urlEncodedBody);

app.use("/api", healthRoutes);

app.use(notFound);
app.use(errorHandler);

httpServer.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
});
