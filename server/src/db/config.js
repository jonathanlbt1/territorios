import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool, types } = pg;

// Return DATE columns as YYYY-MM-DD strings to avoid timezone shift (e.g. 21/02 showing as 22/02)
if (types && typeof types.setTypeParser === 'function') {
  const DATE_OID = 1082;
  types.setTypeParser(DATE_OID, (val) => (val != null ? String(val) : null));
}

/**
 * Determines if SSL should be enabled based on environment variables
 * @param {Object} env - Environment variables object (defaults to process.env)
 * @returns {boolean} - Whether SSL should be enabled
 */
export function shouldUseSsl(env = process.env) {
  return (
    env.DB_SSL === 'true' ||
    env.PGSSLMODE === 'require' ||
    env.SSLMODE === 'require'
  );
}

/**
 * Builds the database configuration object based on environment variables
 * @param {Object} env - Environment variables object (defaults to process.env)
 * @returns {Object} - PostgreSQL pool configuration
 */
export function buildConfig(env = process.env) {
  const useSsl = shouldUseSsl(env);
  const sslConfig = useSsl ? { rejectUnauthorized: false } : undefined;

  // If DATABASE_URL is provided, prefer it (it can include sslmode=require)
  if (env.DATABASE_URL) {
    return {
      connectionString: env.DATABASE_URL,
      ssl: sslConfig,
    };
  }

  // Otherwise, build config from discrete env vars
  return {
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT) || 5432,
    database: env.DB_NAME || 'territorios_db',
    user: env.DB_USER || 'postgres',
    password: env.DB_PASSWORD || 'postgres',
    ssl: sslConfig,
  };
}

/**
 * Creates a new PostgreSQL pool with the given configuration
 * @param {Object} config - Pool configuration (defaults to buildConfig())
 * @returns {pg.Pool} - PostgreSQL pool instance
 */
export function createPool(config = buildConfig()) {
  const pool = new Pool(config);

  pool.on('connect', () => {
    console.log('📦 Connected to PostgreSQL database');
  });

  pool.on('error', (err) => {
    console.error('⚠️  Database connection error:', err.message);
    // Don't exit - allow server to stay running for health checks
    // Individual queries will handle connection failures
  });

  return pool;
}

// Default pool instance for application use
const pool = createPool();

export default pool;

