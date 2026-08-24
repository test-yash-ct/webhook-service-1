import { Pool } from "pg";
import { config } from "./config";

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: parseInt(process.env.DB_POOL_MAX || "25", 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export async function initSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS delivery_attempts (
      id SERIAL PRIMARY KEY,
      merchant_id UUID NOT NULL DEFAULT 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
      target_url TEXT NOT NULL,
      status_code INT,
      signature_verified BOOLEAN DEFAULT false,
      verification_error TEXT,
      idempotency_key UUID UNIQUE,
      attempt_number INT DEFAULT 1,
      correlation_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS delivery_attempts_merchant_created_idx
    ON delivery_attempts (merchant_id, created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS delivery_attempts_idempotency_key_idx
    ON delivery_attempts (idempotency_key) WHERE idempotency_key IS NOT NULL;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS merchant_endpoints (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      merchant_id UUID NOT NULL,
      endpoint_url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS merchant_endpoints_merchant_id_idx
    ON merchant_endpoints (merchant_id);
  `);
}
