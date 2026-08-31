# Webhook Service Runbook

## Ownership

Integrations Engineering owns tier-2 on-call.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVICE_NAME` | `webhook-service` | Log and health identity |
| `LOG_LEVEL` | `info` | Log verbosity |
| `REQUEST_ID_HEADER` | `X-Request-Id` | Correlation header for inbound/outbound HTTP |

## Probes

- **Liveness:** `GET /health`
- **Readiness:** `GET /ready`

## Incident response

Trace delivery failures using `requestId` from processor callbacks through `delivery_attempts.correlation_id` and outbound callback logs.
