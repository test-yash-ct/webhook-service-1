import yaml from "js-yaml";
import { insertAuditEvent, pool } from "../db";
import { buildServiceEvent, isValidEventType, normalizeInboundEnvelope, ServiceEvent } from "../contracts/events";

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number
  ) {
    super(code);
  }
}

const IDEMPOTENCY_KEY_PATTERN = /^[a-f0-9-]{36}$/;

export function parseProcessorBody(contentType: string, bodyStr: string): unknown {
  try {
    if (contentType.includes("yaml")) {
      return yaml.load(bodyStr, { schema: yaml.JSON_SCHEMA });
    }
    return JSON.parse(bodyStr);
  } catch {
    throw new DomainError("invalid_payload_format", 400);
  }
}

export function resolveEventType(parsed: unknown): string {
  if (typeof parsed === "object" && parsed !== null && "type" in parsed) {
    return String((parsed as { type: unknown }).type);
  }
  if (typeof parsed === "object" && parsed !== null && "eventType" in parsed) {
    return String((parsed as { eventType: unknown }).eventType);
  }
  return "unknown";
}

export async function ingestProcessorEvent(params: {
  signatureVerified: boolean;
  merchantId: string;
  correlationId: string;
  requestId: string;
  contentType: string;
  bodyStr: string;
  idempotencyKey: string | undefined;
}): Promise<{ accepted: true; eventType: string; idempotent?: true; event: ServiceEvent }> {
  if (!params.signatureVerified) {
    throw new DomainError("unauthorized", 401);
  }
  const merchantId = params.merchantId.slice(0, 128);
  let idempotencyKey = params.idempotencyKey;

  if (idempotencyKey && typeof idempotencyKey === "string") {
    if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw new DomainError("invalid_idempotency_key_format", 400);
    }
    const existing = await pool.query(
      `SELECT id, status_code, signature_verified FROM delivery_attempts
       WHERE idempotency_key = $1 AND merchant_id = $2 AND signature_verified = true LIMIT 1`,
      [idempotencyKey, merchantId]
    );
    if (existing.rows.length > 0) {
      return {
        accepted: true,
        idempotent: true,
        eventType: "unknown",
        event: buildServiceEvent({
          eventType: "webhook.ingest.idempotent",
          sourceService: "webhook-service",
          requestId: params.requestId || "unknown",
          payload: { merchantId },
        }),
      };
    }
  } else {
    idempotencyKey = undefined;
  }

  let parsed: unknown;
  try {
    parsed = parseProcessorBody(params.contentType, params.bodyStr);
  } catch (err) {
    if (err instanceof DomainError && err.code === "invalid_payload_format") {
      await pool.query(
        `INSERT INTO delivery_attempts (merchant_id, target_url, status_code, verification_error, correlation_id, signature_verified)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [merchantId, "internal://processor/error", 400, "parse_error", params.correlationId, true]
      );
    }
    throw err;
  }

  const envelope = normalizeInboundEnvelope(parsed, params.requestId);
  const eventType = envelope?.eventType ?? resolveEventType(parsed);
  if (!isValidEventType(eventType)) {
    throw new DomainError("invalid_event_type_format", 400);
  }

  await pool.query(
    `INSERT INTO delivery_attempts (merchant_id, target_url, status_code, idempotency_key, correlation_id, signature_verified, attempt_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      merchantId,
      `internal://processor/${eventType}`,
      202,
      idempotencyKey || null,
      params.correlationId,
      true,
      1,
    ]
  );
  await insertAuditEvent({
    action: "ingest_processor_accepted",
    requestId: params.requestId,
    actor: merchantId,
  });

  const event = buildServiceEvent({
    eventType: eventType === "unknown" ? "webhook.ingest.accepted" : eventType,
    sourceService: "webhook-service",
    requestId: params.requestId || "unknown",
    payload: { merchantId },
  });

  return { accepted: true, eventType, event };
}
