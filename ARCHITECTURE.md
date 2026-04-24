# Webhook Service Architecture

## Responsibilities

- Receive HTTP callbacks from card networks and acquirers.
- Validate authenticity of inbound events before updating downstream systems.
- Dispatch asynchronous HTTP notifications to merchant-configured callback URLs.

## Components

| Layer | Technology |
|-------|------------|
| HTTP API | Express on Node.js |
| Persistence | PostgreSQL (`merchant_endpoints`, `delivery_attempts`) |

## Reliability

Failed deliveries are retried with exponential backoff. Callback URLs must be publicly reachable from the platform egress addresses published in the merchant documentation.
