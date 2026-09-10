import { config } from "../config";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const REDACT_KEY_PATTERN =
  /^(password|passwd|secret|token|authorization|auth|jwt|apikey|api_key|signature|rawBody)$/i;

function shouldLog(level: LogLevel): boolean {
  const configured = (config.logLevel || "info").toLowerCase() as LogLevel;
  const threshold = LEVEL_RANK[configured in LEVEL_RANK ? configured : "info"];
  return LEVEL_RANK[level] >= threshold;
}

export function redactFields(
  fields: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (REDACT_KEY_PATTERN.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function log(
  level: LogLevel,
  message: string,
  fields: Record<string, unknown> = {}
): void {
  if (!shouldLog(level)) {
    return;
  }
  const entry = {
    level,
    message,
    service: config.serviceName,
    timestamp: new Date().toISOString(),
    ...redactFields(fields),
  };
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}
