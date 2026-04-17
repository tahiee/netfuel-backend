import type { ErrorRequestHandler } from "express";
import { logger } from "@/utils/logger.util";

const isProd =
  process.env.NODE_ENV === "production" ||
  process.env.RAILWAY_ENVIRONMENT === "production" ||
  !!process.env.RAILWAY_PROJECT_ID;

export const errorHandler: ErrorRequestHandler = (
  err,
  req,
  res,
  _next,
) => {
  logger.error(
    {
      err,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    },
    "Unhandled error",
  );

  res.status(500).json({
    success: false,
    message: isProd ? "Internal server error" : err.message,
    ...(isProd ? {} : { stack: err.stack, path: req.path }),
  });
};
