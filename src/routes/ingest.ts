import { Router, Response, raw } from "express";
import yaml from "js-yaml";
import { pool } from "../db";
import { inboundAuth } from "../middleware/auth";
import { RequestWithId } from "../middleware/requestId";
import { log } from "../lib/logger";

const router = Router();
router.use(inboundAuth);

router.post(
  "/processor",
  raw({ type: ["application/json", "application/x-yaml", "text/yaml", "*/*"], limit: "1mb" }),
  async (req: RequestWithId, res: Response) => {
    try {
      const correlationId = req.requestId || req.correlationId;
      const merchantId = (req as { merchantId?: string }).merchantId || "system";
      const ct = String(req.headers["content-type"] || "");
      let idempotencyKey = req.headers["x-idempotency-key"];
      const bodyStr = req.body instanceof Buffer ? req.body.toString("utf8") : String(req.body);

      log("info", "ingest_processor_start", { requestId: req.requestId, merchantId });

      if (idempotencyKey && typeof idempotencyKey === "string") {
        if (!/^[a-f0-9\-]{36}$/.test(idempotencyKey)) {
          res.status(400).json({ error: "invalid_idempotency_key_format" });
          return;
        }
        const existing = await pool.query(
          `SELECT id, status_code, signature_verified FROM delivery_attempts
           WHERE idempotency_key = $1 AND merchant_id = $2 AND signature_verified = true LIMIT 1`,
          [idempotencyKey, merchantId]
        );
        if (existing.rows.length > 0) {
          res.status(202).json({ accepted: true, idempotent: true, eventType: "unknown" });
          return;
        }
      } else {
        idempotencyKey = undefined;
      }

      let parsed: unknown;
      try {
        if (ct.includes("yaml")) {
          parsed = yaml.load(bodyStr);
        } else {
          parsed = JSON.parse(bodyStr);
        }
      } catch (_parseErr) {
        await pool.query(
          `INSERT INTO delivery_attempts (merchant_id, target_url, status_code, verification_error, correlation_id, signature_verified)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [merchantId, "internal://processor/error", 400, "parse_error", correlationId, true]
        );
        res.status(400).json({ error: "invalid_payload_format" });
        return;
      }

      const eventType =
        typeof parsed === "object" && parsed !== null && "type" in parsed
          ? String((parsed as { type: unknown }).type)
          : "unknown";

      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(eventType)) {
        res.status(400).json({ error: "invalid_event_type_format" });
        return;
      }

      await pool.query(
        `INSERT INTO delivery_attempts (merchant_id, target_url, status_code, idempotency_key, correlation_id, signature_verified, attempt_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          merchantId,
          `internal://processor/${eventType}`,
          202,
          idempotencyKey || null,
          correlationId,
          true,
          1,
        ]
      );
      log("info", "ingest_processor_accepted", { requestId: req.requestId, eventType });
      res.status(202).json({ accepted: true, eventType });
    } catch (err) {
      log("error", "ingest_processor_error", {
        requestId: req.requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: "internal_server_error" });
    }
  }
);

export default router;
