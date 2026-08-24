import { Request, Response, NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";

export function dispatchAuth(req: Request, res: Response, next: NextFunction): void {
  const internalKey = process.env.INTERNAL_SERVICE_KEY;
  const providedKey = String(req.headers["x-internal-service-key"] || "");

  if (internalKey && providedKey) {
    const keyBuf = Buffer.from(providedKey);
    const expectedBuf = Buffer.from(internalKey);
    if (keyBuf.length === expectedBuf.length) {
      try {
        if (timingSafeEqual(keyBuf, expectedBuf)) {
          (req as any).merchantId = req.headers["x-merchant-id"] || "system";
          (req as any).signatureVerified = true;
          next();
          return;
        }
      } catch {
        // fall through to signature check
      }
    }
  }

  const secret = process.env.WEBHOOK_SIGNING_KEY;
  if (!secret || secret.length < 32) {
    res.status(500).json({ error: "dispatch_auth_not_configured" });
    return;
  }

  const signature = String(req.headers["x-signature"] || "");
  const rawBody = (req as any).rawBody;
  if (!signature || !rawBody) {
    res.status(401).json({ error: "missing_dispatch_auth" });
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
      res.status(401).json({ error: "invalid_signature" });
      return;
    }
  } catch {
    res.status(401).json({ error: "invalid_signature" });
    return;
  }

  (req as any).merchantId = req.headers["x-merchant-id"] || "system";
  (req as any).signatureVerified = true;
  next();
}
