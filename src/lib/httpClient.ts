import axios from "axios";
import { URL } from "url";
import { config } from "../config";
import { log } from "./logger";

export function isSSRFVulnerable(hostname: string | null): boolean {
  if (!hostname) return true;

  const lower = hostname.toLowerCase();

  const blockedHosts = [
    "127.0.0.1",
    "localhost",
    "0.0.0.0",
    "::1",
    "::ffff:127.0.0.1",
    "169.254.169.254",
  ];

  if (blockedHosts.includes(lower)) return true;

  const blockedPatterns = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^localhost/i,
    /\.local$/i,
    /metadata\.google/i,
    /169\.254\.169\.254/,
    /^\[::1\]/,
    /^\[::ffff:127/,
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(lower)) return true;
  }

  try {
    const ip = require("net").isIP(lower);
    if (ip === 4) {
      const parts = lower.split(".").map(Number);
      if (parts[0] === 127 || parts[0] === 10 || parts[0] === 172 || parts[0] === 192 || parts[0] === 169) {
        return true;
      }
      if ((parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168)) {
        return true;
      }
    }
    if (ip === 6) {
      if (lower === "::1" || lower.startsWith("fe80:") || lower.startsWith("fc00:") || lower.startsWith("fd00:")) {
        return true;
      }
    }
  } catch {}

  return false;
}

export async function fetchCallback(
  url: string,
  requestId?: string
): Promise<{ status: number; data: string }> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { status: 400, data: "invalid_url" };
  }

  if (isSSRFVulnerable(parsedUrl.hostname)) {
    log("warn", "callback_blocked_ssrf", { requestId, urlHost: parsedUrl.hostname });
    return { status: 403, data: "blocked_url_pattern" };
  }

  const maxAttempts = 3;
  const baseDelayMs = 100;
  const totalTimeoutMs = 15000;
  const perAttemptTimeoutMs = 8000;

  let lastStatus = 0;
  let lastData = "";
  const startTime = Date.now();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (Date.now() - startTime > totalTimeoutMs) {
        break;
      }

      const delayMs = baseDelayMs * Math.pow(2, attempt) + Math.random() * 100;
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, Math.min(delayMs, 5000)));
      }

      const headers: Record<string, string> = {};
      if (requestId) {
        headers[config.requestIdHeader] = requestId;
      }

      log("info", "callback_fetch_attempt", { requestId, attempt: attempt + 1, urlHost: parsedUrl.hostname });

      const resp = await axios.get(url, {
        maxRedirects: 0,
        validateStatus: () => true,
        timeout: perAttemptTimeoutMs,
        responseType: "text",
        headers,
      });

      lastStatus = resp.status;
      lastData = typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data);

      if (resp.status >= 200 && resp.status < 300) {
        break;
      }

      if (resp.status >= 400) {
        break;
      }
    } catch (err) {
      lastStatus = 0;
      lastData = "request_failed";
      log("warn", "callback_fetch_error", {
        requestId,
        attempt: attempt + 1,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { status: lastStatus, data: lastData.slice(0, 65536) };
}
