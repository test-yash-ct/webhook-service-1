import { config } from "../config";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function shouldLog(level: LogLevel): boolean {
  const configured = (config.logLevel || "info").toLowerCase() as LogLevel;
  const threshold = LEVEL_RANK[configured in LEVEL_RANK ? configured : "info"];
  return LEVEL_RANK[level] >= threshold;
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
    ...fields,
  };
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}
