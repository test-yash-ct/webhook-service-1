import { Router, Request, Response } from "express";
import { fetchCallback } from "../lib/httpClient";
import { pool } from "../db";

const router = Router();

router.post("/test", async (req: Request, res: Response) => {
  const url = String((req.body as { callbackUrl?: string }).callbackUrl || "");
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    res.status(400).json({ error: "callbackUrl_must_be_http" });
    return;
  }
  const result = await fetchCallback(url);
  await pool.query(
    `INSERT INTO delivery_attempts (target_url, status_code) VALUES ($1, $2)`,
    [url, result.status]
  );
  res.json({ status: result.status, snippet: result.data.slice(0, 512) });
});

export default router;
