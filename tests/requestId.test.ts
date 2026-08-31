import test from "node:test";
import assert from "node:assert";
import express from "express";
import http from "node:http";
import { requestIdMiddleware } from "../src/middleware/requestId";
import { config } from "../src/config";

test("request id middleware generates uuid when absent", async () => {
  const app = express();
  app.use(requestIdMiddleware);
  app.get("/probe", (req, res) => {
    res.json({
      requestId: (req as { requestId?: string }).requestId,
      correlationId: (req as { correlationId?: string }).correlationId,
    });
  });

  const server = await new Promise<http.Server>((resolve, reject) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
    s.on("error", reject);
  });

  try {
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("bad address");
    const body = await new Promise<Record<string, unknown>>((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${addr.port}/probe`, (res) => {
          let data = "";
          res.on("data", (c) => {
            data += c;
          });
          res.on("end", () => resolve(JSON.parse(data) as Record<string, unknown>));
        })
        .on("error", reject);
    });
    assert.match(String(body.requestId), /^[0-9a-f-]{36}$/i);
    assert.strictEqual(body.correlationId, body.requestId);
  } finally {
    server.close();
  }
});

test("structured logs include service and requestId", async () => {
  const { log } = await import("../src/lib/logger");
  const chunks: string[] = [];
  const stdout = process.stdout as NodeJS.WriteStream & {
    write: (chunk: string | Uint8Array) => boolean;
  };
  const originalWrite = stdout.write.bind(stdout);
  stdout.write = (chunk: string | Uint8Array) => {
    chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    return true;
  };

  try {
    log("info", "dispatch_probe", { requestId: "wh-1" });
    const parsed = JSON.parse(chunks[0]) as Record<string, unknown>;
    assert.strictEqual(parsed.service, config.serviceName);
    assert.strictEqual(parsed.requestId, "wh-1");
  } finally {
    stdout.write = originalWrite;
  }
});
