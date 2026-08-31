# Webhook Service Architecture

## Responsibilities

- Verify inbound processor webhook signatures.
- Persist delivery attempts with correlation ids.
- Dispatch HTTPS callbacks to merchant endpoints with SSRF protections.

## Components

| Layer | Technology |
|-------|------------|
| HTTP API | Express on Node.js |
| Persistence | PostgreSQL (`delivery_attempts`, `merchant_endpoints`) |
| Outbound HTTP | axios with egress allowlist |
| Observability | `X-Request-Id` middleware, JSON structured logs |

## Request correlation

Request-id middleware runs before ingest and dispatch routes. `req.requestId` maps to the legacy `correlationId` field for database compatibility. Outbound `fetchCallback` forwards the id via `REQUEST_ID_HEADER`.

## Platform integration

- Receives payment events from external processors.
- Notifies merchant endpoints configured via the billing product.
