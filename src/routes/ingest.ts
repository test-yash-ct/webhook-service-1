import { Router, Response, raw, Request } from "express";
import { inboundAuth } from "../middleware/auth";
import { RequestWithId } from "../middleware/requestId";
import { log } from "../lib/logger";
import { DomainError, ingestProcessorEvent } from "../domain/ingest";

const router = Router();
router.use(inboundAuth);

router.post(
  "/processor",
  raw({ type: ["application/json", "application/x-yaml", "text/yaml", "*/*"], limit: "1mb" }),
  async (req: RequestWithId, res: Response) => {
    try {
      const correlationId = req.requestId || req.correlationId;
      const merchantId = (req as { merchantId?: string }).merchantId || "system";
      const ct = String(req.headers["content-type"] || "");
      const idempotencyHeader = req.headers["x-idempotency-key"];
      const bodyStr = req.body instanceof Buffer ? req.body.toString("utf8") : String(req.body);

      log("info", "ingest_processor_start", { requestId: req.requestId, merchantId });

      const result = await ingestProcessorEvent({
        signatureVerified: Boolean((req as Request & { signatureVerified?: boolean }).signatureVerified),
        merchantId,
        correlationId: correlationId || "unknown",
        requestId: req.requestId || "unknown",
        contentType: ct,
        bodyStr,
        idempotencyKey: typeof idempotencyHeader === "string" ? idempotencyHeader : undefined,
      });

      log("info", "ingest_processor_accepted", { requestId: req.requestId, eventType: result.eventType });
      res.status(202).json({
        accepted: true,
        eventType: result.eventType,
        idempotent: result.idempotent,
        event: result.event,
      });
    } catch (err) {
      if (err instanceof DomainError) {
        res.status(err.httpStatus).json({ error: err.code });
        return;
      }
      log("error", "ingest_processor_error", {
        requestId: req.requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: "internal_server_error" });
    }
  }
);

export default router;
