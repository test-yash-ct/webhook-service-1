import { URL } from "url";
import { fetchCallback, isSSRFVulnerable } from "../lib/httpClient";
import { pool } from "../db";
import { DomainError } from "./ingest";

const IDEMPOTENCY_KEY_PATTERN = /^[a-f0-9-]{36}$/;

export async function validateCallbackUrl(url: string): Promise<{ valid: boolean; error?: string }> {
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

export async function dispatchTestCallback(params: {
  callbackUrl: string;
  merchantId: string;
  correlationId: string;
  requestId: string;
  idempotencyKey: string | undefined;
}): Promise<{ status: number; snippet: string; idempotent?: true }> {
  const url = params.callbackUrl;
  const merchantId = params.merchantId.slice(0, 128);
  let idempotencyKey = params.idempotencyKey;

  if (idempotencyKey && typeof idempotencyKey === "string") {
    if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw new DomainError("invalid_idempotency_key_format", 400);
    }
    const existing = await pool.query(
      `SELECT id, status_code, signature_verified FROM delivery_attempts
       WHERE idempotency_key = $1 AND merchant_id = $2 AND target_url = $3 AND signature_verified = true LIMIT 1`,
      [idempotencyKey, merchantId, url]
    );
    if (existing.rows.length > 0) {
      return { status: existing.rows[0].status_code as number, idempotent: true, snippet: "" };
    }
  } else {
    idempotencyKey = undefined;
  }

  const validation = await validateCallbackUrl(url);
  if (!validation.valid) {
    throw new DomainError(validation.error || "invalid_url", 400);
  }

  const result = await fetchCallback(url, params.requestId);
  await pool.query(
    `INSERT INTO delivery_attempts (merchant_id, target_url, status_code, correlation_id, idempotency_key, attempt_number)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [merchantId, url, result.status, params.correlationId, idempotencyKey || null, 1]
  );
  return { status: result.status, snippet: result.data.slice(0, 512) };
}
