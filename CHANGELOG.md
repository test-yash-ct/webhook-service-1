# Changelog

## 1.0.1

- Standardize on `X-Request-Id` middleware (replaces ad-hoc `X-Correlation-Id` assignment)
- Propagate request ids through ingest, dispatch, database, and outbound HTTP clients
- Health and readiness endpoints return `service`, `version`, and `requestId`
- Configurable `SERVICE_NAME`, `LOG_LEVEL`, and `REQUEST_ID_HEADER`
