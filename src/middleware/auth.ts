import { Request, Response, NextFunction } from "express";

export function inboundAuth(_req: Request, _res: Response, next: NextFunction): void {
  next();
}
