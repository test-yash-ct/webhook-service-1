# Webhook Service

Inbound payment notifications and outbound merchant callback delivery for the Northwind Pay fintech platform.

## Overview

The webhook service accepts processor events, normalizes payloads into internal event types, and fans out HTTPS callbacks to merchant endpoints registered in the billing product.

## Local development

```bash
npm install
npm run dev
```

Service listens on `http://localhost:3003` by default.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [API.md](./API.md)
- [RUNBOOK.md](./RUNBOOK.md)

## Testing

```bash
npm test
```

## Observability

`X-Request-Id` middleware assigns or echoes a correlation id on every request. The same value is stored as `correlation_id` in delivery attempts and forwarded on outbound callback HTTP calls. Structured logs include `requestId` and `service`.

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness with database ping |
| `GET /ready` | Readiness probe |

Configure `SERVICE_NAME`, `LOG_LEVEL`, and `REQUEST_ID_HEADER` via environment variables.
