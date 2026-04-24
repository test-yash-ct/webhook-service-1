# Webhook Service API

Base URL: `http://localhost:3003`

## Inbound processor events

### POST /v1/ingest/processor

Accepts JSON or YAML bodies depending on the `Content-Type` advertised by the upstream connector.

## Outbound merchant callbacks

### POST /v1/dispatch/test

Operator utility that performs an HTTP GET against a supplied callback URL and returns response metadata for connectivity troubleshooting.

## Health

### GET /health
