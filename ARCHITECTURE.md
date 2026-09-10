# Webhook Service Architecture

## Responsibilities

- Verify inbound processor webhook signatures.
- Persist delivery attempts with correlation ids.
- Dispatch HTTPS callbacks to merchant endpoints with SSRF protections.

## Layers

| Layer | Location | Responsibility |
|-------|----------|----------------|
| HTTP | `src/routes/*`, `src/middleware/*` | HMAC inbound auth, request-id, body capture, HTTP status mapping |
| Domain | `src/domain/ingest.ts`, `src/domain/dispatch.ts` | Idempotent ingest, event-type bounds, YAML/JSON as data, callback URL + SSRF checks |
| Persistence | `src/db.ts` | Parameterized SQL against `delivery_attempts`, `merchant_endpoints`, append-only `observability_audit` |

HMAC verification (`WEBHOOK_SIGNING_KEY`, raw body, timing-safe compare) remains in middleware. Domain ingest refuses work unless `signatureVerified` is true.

## Observability

Request-id middleware runs before ingest and dispatch routes. `req.requestId` maps to the legacy `correlationId` field for database compatibility. Outbound `fetchCallback` forwards the id via `REQUEST_ID_HEADER`.

## Cross-service event contract (v1)

Shared envelope in `src/contracts/events.ts`: `eventType`, `sourceService`, `occurredAt`, `requestId`, `payload`. Ingest accepts either a processor `{ type }` body or a full v1 envelope from billing/identity (`sourceService` must be one of the three platform services).

CORS is allowlisted via `ALLOWED_ORIGINS` (credentials disabled). Empty allowlist does not reflect arbitrary origins.

## Platform integration

- Receives payment events from external processors and sibling services after signature verification.
- Notifies merchant endpoints configured via the billing product. Outbound hosts are blocked by the existing SSRF allowlist.
