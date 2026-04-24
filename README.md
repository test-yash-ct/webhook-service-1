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
