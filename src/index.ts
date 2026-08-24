import express from "express";
import cors from "cors";
import ingestRoutes from "./routes/ingest";
import dispatchRoutes from "./routes/dispatch";
import { initSchema, pool } from "./db";
import { config } from "./config";
import { rateLimit } from "./middleware/rateLimit";

async function main(): Promise<void> {
  await initSchema();
  const app = express();

  app.use((req, _res, next) => {
    let data = "";
    req.on("data", (chunk: Buffer) => {
      data += chunk.toString("utf-8");
    });
    req.on("end", () => {
      (req as any).rawBody = data;
      next();
    });
  });

  app.use(express.json({ limit: "128kb" }));
  app.use(rateLimit(parseInt(process.env.RATE_LIMIT_PER_MINUTE || "500", 10)));

  app.use(
    cors({
      origin: (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean) || ["localhost"],
      credentials: false,
      methods: ["POST", "GET"],
      allowedHeaders: ["Content-Type", "X-Signature", "X-Idempotency-Key"],
    })
  );

  app.use((req, _res, next) => {
    (req as any).correlationId =
      req.headers["x-correlation-id"] || require("crypto").randomUUID();
    next();
  });

  app.use((req, _res, next) => {
    const timeout = setTimeout(() => {
      if (!req.socket.destroyed) {
        req.socket.destroy();
      }
    }, 30000);
    req.on("close", () => clearTimeout(timeout));
    next();
  });

  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", service: "webhook-service" });
    } catch {
      res.status(503).json({ status: "unhealthy" });
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
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      process.stderr.write(`Error: ${err.message}\n`);
      res.status(500).json({ error: "internal_server_error" });
    }
  );

  const server = app.listen(config.port, () => {
    process.stdout.write(`webhook-service listening on ${config.port}\n`);
  });

  const gracefulShutdown = async () => {
    process.stdout.write("Shutting down gracefully...\n");
    server.close(async () => {
      try {
        await pool.end();
      } catch (e) {
        process.stderr.write(`Error closing pool: ${e}\n`);
      }
      process.exit(0);
    });

    setTimeout(() => {
      process.stderr.write("Forced shutdown after timeout\n");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
  process.on("unhandledRejection", (reason) => {
    process.stderr.write(`Unhandled rejection: ${reason}\n`);
    gracefulShutdown();
  });
}

main().catch((e) => {
  process.stderr.write(String(e));
  process.exit(1);
});
