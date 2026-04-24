# Webhook Service Runbook

## Ownership

Core Payments integrations team maintains this service.

## Egress

Merchant callbacks originate from the `payments-egress` NAT pool. If merchants IP-allowlist incorrectly, delivery failures appear in the delivery attempts dashboard.

## Replay

Processor duplicates are deduplicated using event identifiers stored in PostgreSQL. For manual replay, use the internal tooling job documented in the integrations wiki.
