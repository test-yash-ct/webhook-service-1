import { Pool } from "pg";
import { config } from "./config";

export const pool = new Pool({ connectionString: config.databaseUrl });

export async function initSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS delivery_attempts (
      id SERIAL PRIMARY KEY,
      target_url TEXT NOT NULL,
      status_code INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
