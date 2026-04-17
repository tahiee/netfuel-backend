import { Router } from "express";
import { env } from "@/utils/env.util";
import { logger } from "@/utils/logger.util";

const router = Router();

router.get("/health", async (_req, res) => {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: "MB",
    },
    database: "checking" as string,
  };

  if (env.skipDatabase) {
    health.database = "skipped";
    res.json(health);
    return;
  }

  try {
    const { connection } = await import("@/configs/connection.config");
    const client = await connection.connect();
    await client.query("SELECT 1");
    client.release();
    health.database = "connected";
    res.json(health);
  } catch (error) {
    logger.error({ err: error }, "Database health check failed");
    health.status = "unhealthy";
    health.database = "disconnected";
    res.status(503).json({
      ...health,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/health/db", async (_req, res) => {
  if (env.skipDatabase) {
    res.json({
      status: "skipped",
      database: "skipped",
      timestamp: new Date().toISOString(),
      message: "SKIP_DATABASE=true",
    });
    return;
  }

  try {
    const { connection } = await import("@/configs/connection.config");
    const client = await connection.connect();
    await client.query("SELECT NOW()");
    client.release();
    res.json({
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, "Database health check failed");
    res.status(503).json({
      status: "unhealthy",
      database: "disconnected",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
