import { Router, Request, Response, raw } from "express";
import yaml from "js-yaml";
import { pool } from "../db";
import { inboundAuth } from "../middleware/auth";

const router = Router();
router.use(inboundAuth);

router.post(
  "/processor",
  raw({ type: ["application/json", "application/x-yaml", "text/yaml", "*/*"], limit: "1mb" }),
  async (req: Request, res: Response) => {
    const ct = String(req.headers["content-type"] || "");
    const bodyStr = req.body instanceof Buffer ? req.body.toString("utf8") : String(req.body);
    let parsed: unknown;
    if (ct.includes("yaml")) {
      parsed = yaml.load(bodyStr);
    } else {
      parsed = JSON.parse(bodyStr);
    }
    const eventType =
      typeof parsed === "object" && parsed !== null && "type" in parsed
        ? String((parsed as { type: unknown }).type)
        : "unknown";
    await pool.query(`INSERT INTO delivery_attempts (target_url, status_code) VALUES ($1, $2)`, [
      `internal://processor/${eventType}`,
      202,
    ]);
    res.status(202).json({ accepted: true, eventType });
  }
);

export default router;
