import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { config } from "../config";

export interface RequestWithId extends Request {
  requestId?: string;
  correlationId?: string;
}

export function requestIdMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction
): void {
  const header = config.requestIdHeader;
  const incoming = req.headers[header.toLowerCase()];
  const requestId =
    typeof incoming === "string" && incoming.trim().length > 0
      ? incoming.trim()
      : randomUUID();

  req.requestId = requestId;
  req.correlationId = requestId;
  res.setHeader(header, requestId);
  next();
}
