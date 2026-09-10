import test from "node:test";
import assert from "node:assert";
import express from "express";
import http from "node:http";
import { requestIdMiddleware } from "../src/middleware/requestId";
import { config } from "../src/config";

test("health response includes service and requestId", async () => {
  const app = express();
  app.use(requestIdMiddleware);
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      service: config.serviceName,
      version: config.version,
      requestId: (req as { requestId?: string }).requestId,
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
        .get(`http://127.0.0.1:${addr.port}/health`, (res) => {
          let data = "";
          res.on("data", (c) => { data += c; });
          res.on("end", () => resolve(JSON.parse(data) as Record<string, unknown>));
        })
        .on("error", reject);
    });
    assert.strictEqual(body.service, config.serviceName);
    assert.strictEqual(typeof body.requestId, "string");
  } finally {
    server.close();
  }
});

test("provided X-Request-Id is echoed", async () => {
  const app = express();
  app.use(requestIdMiddleware);
  app.get("/probe", (req, res) => {
    res.json({ requestId: (req as { requestId?: string }).requestId });
  });

  const provided = "webhook-req-77";
  const server = await new Promise<http.Server>((resolve, reject) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
    s.on("error", reject);
  });

  try {
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("bad address");
    const result = await new Promise<{ body: Record<string, unknown>; header?: string }>(
      (resolve, reject) => {
        http
          .get(`http://127.0.0.1:${addr.port}/probe`, {
            headers: { [config.requestIdHeader]: provided },
          }, (res) => {
            let data = "";
            res.on("data", (c) => { data += c; });
            res.on("end", () =>
              resolve({
                body: JSON.parse(data) as Record<string, unknown>,
                header: res.headers[config.requestIdHeader.toLowerCase()] as string | undefined,
              })
            );
          })
          .on("error", reject);
      }
    );
    assert.strictEqual(result.body.requestId, provided);
    assert.strictEqual(result.header, provided);
  } finally {
    server.close();
  }
});
