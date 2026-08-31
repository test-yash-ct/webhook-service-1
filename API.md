# Webhook Service API

Base URL: `http://localhost:3003`

## Ingest

### POST /v1/ingest/processor

Accepts signed processor payloads (JSON or YAML). Requires `X-Signature` header.

## Dispatch

### POST /v1/dispatch/test

Tests callback delivery to a merchant URL. Outbound requests include `X-Request-Id` when present on the inbound call.

## Health

### GET /health

Returns `{ status, service, version, requestId }`. Verifies database connectivity.

### GET /ready

Readiness probe with database check.

## Request correlation

Clients should send `X-Request-Id`. The service echoes the header on responses and propagates it through ingest, dispatch, database writes, and outbound HTTP clients.
