import express from "express";
import cors from "cors";
import ingestRoutes from "./routes/ingest";
import dispatchRoutes from "./routes/dispatch";
import { initSchema, pool } from "./db";
import { config } from "./config";
import { requestIdMiddleware, RequestWithId } from "./middleware/requestId";
import { log } from "./lib/logger";

async function main(): Promise<void> {
  await initSchema();
  const app = express();

  app.use((req, _res, next) => {
    let data = "";
    req.on("data", (chunk: Buffer) => {
      data += chunk.toString("utf-8");
    });
    req.on("end", () => {
      (req as express.Request & { rawBody?: string }).rawBody = data;
      next();
    });
  });

  app.use(requestIdMiddleware);
  app.use(express.json({ limit: "128kb" }));

  app.use(
    cors({
      origin: (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean) || ["localhost"],
      credentials: false,
      methods: ["POST", "GET"],
      allowedHeaders: [
        "Content-Type",
        "X-Signature",
        "X-Idempotency-Key",
        config.requestIdHeader,
      ],
    })
  );

  app.use((req, _res, next) => {
    const timeout = setTimeout(() => {
      if (!req.socket.destroyed) {
        req.socket.destroy();
      }
    }, 30000);
    req.on("close", () => clearTimeout(timeout));
    next();
  });

  app.get("/health", async (req: RequestWithId, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({
        status: "ok",
        service: config.serviceName,
        version: config.version,
        requestId: req.requestId,
      });
    } catch (err) {
      log("error", "health_check_failed", {
        requestId: req.requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(503).json({
        status: "unhealthy",
        service: config.serviceName,
        version: config.version,
        requestId: req.requestId,
      });
    }
  });

  app.get("/ready", async (req: RequestWithId, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({
        status: "ready",
        service: config.serviceName,
        version: config.version,
        requestId: req.requestId,
      });
    } catch (err) {
      log("error", "readiness_check_failed", {
        requestId: req.requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(503).json({
        status: "not_ready",
        service: config.serviceName,
        version: config.version,
        requestId: req.requestId,
      });
    }
  });

  app.use("/v1/ingest", ingestRoutes);
  app.use("/v1/dispatch", dispatchRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  app.use(
    (
      err: Error,
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const requestId = (req as RequestWithId).requestId;
      log("error", "unhandled_error", { requestId, error: err.message });
      res.status(500).json({ error: "internal_server_error", requestId });
    }
  );

  const server = app.listen(config.port, () => {
    log("info", "service_started", { port: config.port });
  });

  const gracefulShutdown = async () => {
    log("info", "shutdown_started", {});
    server.close(async () => {
      try {
        await pool.end();
      } catch (e) {
        log("error", "pool_close_failed", { error: String(e) });
      }
      process.exit(0);
    });

    setTimeout(() => {
      log("error", "forced_shutdown", {});
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
  process.on("unhandledRejection", (reason) => {
    log("error", "unhandled_rejection", { reason: String(reason) });
    gracefulShutdown();
  });
}

main().catch((e) => {
  process.stderr.write(String(e));
  process.exit(1);
});
