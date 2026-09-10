import { Router, Response } from "express";
import { RequestWithId } from "../middleware/requestId";
import { log } from "../lib/logger";
import { dispatchTestCallback } from "../domain/dispatch";
import { DomainError } from "../domain/ingest";

const router = Router();

router.post("/test", async (req: RequestWithId, res: Response) => {
  try {
    const url = String((req.body as { callbackUrl?: string }).callbackUrl || "");
    const merchantId = (req as { merchantId?: string }).merchantId || "system";
    const correlationId = req.requestId || req.correlationId;
    const idempotencyHeader = req.headers["x-idempotency-key"];

    log("info", "dispatch_test_start", { requestId: req.requestId, merchantId });

    const result = await dispatchTestCallback({
      callbackUrl: url,
      merchantId,
      correlationId: correlationId || "unknown",
      requestId: req.requestId || "unknown",
      idempotencyKey: typeof idempotencyHeader === "string" ? idempotencyHeader : undefined,
    });

    log("info", "dispatch_test_complete", { requestId: req.requestId, status: result.status });
    res.json({ status: result.status, snippet: result.snippet, idempotent: result.idempotent });
  } catch (err) {
    if (err instanceof DomainError) {
      res.status(err.httpStatus).json({ error: err.code });
      return;
    }
    log("error", "dispatch_test_error", {
      requestId: req.requestId,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: "internal_server_error" });
  }
});

export default router;
