import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { config } from "../config";

export interface RequestWithId extends Request {
  requestId?: string;
  correlationId?: string;
}

const REQUEST_ID_MAX_LEN = 128;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

export function resolveRequestId(incoming: unknown): string {
  if (typeof incoming === "string") {
    const trimmed = incoming.trim();
    if (
      trimmed.length > 0 &&
      trimmed.length <= REQUEST_ID_MAX_LEN &&
      REQUEST_ID_PATTERN.test(trimmed)
    ) {
      return trimmed;
    }
  }
  return randomUUID();
}

export function requestIdMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction
): void {
  const header = config.requestIdHeader;
  const requestId = resolveRequestId(req.headers[header.toLowerCase()]);
  req.requestId = requestId;
  req.correlationId = requestId;
  res.setHeader(header, requestId);
  next();
}
