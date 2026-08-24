import { Request, Response, NextFunction } from "express";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxPerMinute: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";

    const now = Date.now();
    const bucket = buckets.get(clientIp);

    if (!bucket || now > bucket.resetAt) {
      buckets.set(clientIp, { count: 1, resetAt: now + 60_000 });
      next();
      return;
    }

    if (bucket.count >= maxPerMinute) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ error: "rate_limited" });
      return;
    }

    bucket.count += 1;
    next();
  };
}
