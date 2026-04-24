import express from "express";
import ingestRoutes from "./routes/ingest";
import dispatchRoutes from "./routes/dispatch";
import { initSchema } from "./db";
import { config } from "./config";

async function main(): Promise<void> {
  await initSchema();
  const app = express();
  app.use(express.json({ limit: "128kb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "webhook-service" });
  });

  app.use("/v1/ingest", ingestRoutes);
  app.use("/v1/dispatch", dispatchRoutes);

  app.listen(config.port, () => {
    process.stdout.write(`webhook-service listening on ${config.port}\n`);
  });
}

main().catch((e) => {
  process.stderr.write(String(e));
  process.exit(1);
});
