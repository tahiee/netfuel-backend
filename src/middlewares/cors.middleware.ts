import cors, { type CorsOptions } from "cors";
import type { RequestHandler } from "express";
import { env } from "@/utils/env.util";

const allowedStatic = [
  "http://localhost:3000",
  "http://localhost:4000",
  "http://localhost:4001",
];

export function createCorsMiddleware(): RequestHandler {
  const frontend = env.FRONTEND_DOMAIN.replace(/\/$/, "");
  const origins = new Set([
    frontend,
    `${frontend}/`,
    ...allowedStatic,
  ]);

  const options: CorsOptions = {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (origins.has(origin) || origins.has(origin.replace(/\/$/, ""))) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Cache-Control",
      "Pragma",
    ],
  };

  return cors(options);
}
