import { Request, Response, NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { RequestWithId } from "./requestId";
import { log } from "../lib/logger";

export function inboundAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.WEBHOOK_SIGNING_KEY;
  if (!secret || secret.length < 32) {
    res.status(500).json({ error: "webhook_signing_key_not_configured_or_weak" });
    return;
  }

  const signature = String(req.headers["x-signature"] || "");
  if (!signature) {
    log("warn", "missing_signature", { requestId: (req as RequestWithId).requestId });
    res.status(401).json({ error: "missing_signature" });
    return;
  }

  const rawBody = (req as Request & { rawBody?: string }).rawBody;
  if (!rawBody) {
    res.status(400).json({ error: "unable_to_verify_signature" });
    return;
  }

  if (!/^[a-f0-9]{64}$/.test(signature)) {
    res.status(401).json({ error: "invalid_signature_format" });
    return;
  }

  const expectedSig = createHmac("sha256", secret).update(rawBody).digest("hex");
  const signatureBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expectedSig, "hex");

  if (signatureBuf.length !== expectedBuf.length) {
    res.status(401).json({ error: "invalid_signature" });
    return;
  }

  try {
    if (!timingSafeEqual(signatureBuf, expectedBuf)) {
      log("warn", "invalid_signature", { requestId: (req as RequestWithId).requestId });
      res.status(401).json({ error: "invalid_signature" });
      return;
    }
  } catch {
    res.status(401).json({ error: "invalid_signature" });
    return;
  }

  (req as Request & { signatureVerified?: boolean }).signatureVerified = true;
  next();
}
