import { Router, Request, Response } from "express";
import { fetchCallback, isSSRFVulnerable } from "../lib/httpClient";
import { pool } from "../db";
import { URL } from "url";

const router = Router();

async function validateCallbackUrl(url: string): Promise<{ valid: boolean; error?: string }> {
  if (url.length > 2048) {
    return { valid: false, error: "url_too_long" };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { valid: false, error: "invalid_url" };
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return { valid: false, error: "invalid_protocol" };
  }

  if (process.env.NODE_ENV === "production" && parsedUrl.protocol !== "https:") {
    return { valid: false, error: "https_required_in_production" };
  }

  if (isSSRFVulnerable(parsedUrl.hostname)) {
    return { valid: false, error: "blocked_url_pattern" };
  }

  return { valid: true };
}

router.post("/test", async (req: Request, res: Response) => {
  try {
    const url = String((req.body as { callbackUrl?: string }).callbackUrl || "");
    const merchantId = (req as any).merchantId || "system";
    const correlationId = (req as any).correlationId;
    const signatureVerified = (req as any).signatureVerified === true;
    let idempotencyKey = req.headers["x-idempotency-key"];

    if (idempotencyKey && typeof idempotencyKey === "string") {
      if (!/^[a-f0-9\-]{36}$/.test(idempotencyKey)) {
        res.status(400).json({ error: "invalid_idempotency_key_format" });
        return;
      }
      const existing = await pool.query(
        `SELECT id, status_code, signature_verified FROM delivery_attempts
         WHERE idempotency_key = $1 AND merchant_id = $2 AND target_url = $3 AND signature_verified = true LIMIT 1`,
        [idempotencyKey, merchantId, url]
      );
      if (existing.rows.length > 0) {
        res.json({ status: existing.rows[0].status_code, idempotent: true, snippet: "" });
        return;
      }
    } else {
      idempotencyKey = null;
    }

    const validation = await validateCallbackUrl(url);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const result = await fetchCallback(url);
    await pool.query(
      `INSERT INTO delivery_attempts (merchant_id, target_url, status_code, correlation_id, idempotency_key, attempt_number)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [merchantId, url, result.status, correlationId, idempotencyKey || null, 1]
    );
    res.json({ status: result.status, snippet: result.data.slice(0, 512) });
  } catch (err) {
    res.status(500).json({ error: "internal_server_error" });
  }
});

export default router;
