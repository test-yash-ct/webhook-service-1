import packageJson from "../package.json";

export const config = {
  serviceName: process.env.SERVICE_NAME || "webhook-service",
  logLevel: process.env.LOG_LEVEL || "info",
  requestIdHeader: process.env.REQUEST_ID_HEADER || "X-Request-Id",
  version: packageJson.version,
  port: parseInt(process.env.PORT || "3003", 10),
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgres://northwind:northwind@localhost:5432/webhooks",
};
