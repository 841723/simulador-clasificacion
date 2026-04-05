import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// DATABASE_SSL=true enables SSL for cloud-hosted DBs.
// rejectUnauthorized can be set to false only when using self-signed certs
// in a trusted private network. For production with a public CA, leave it
// at the default (true) by not setting DATABASE_SSL_REJECT_UNAUTHORIZED=false.
const sslConfig = (() => {
  if (process.env.DATABASE_SSL !== 'true') return false;
  if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false') {
    return { rejectUnauthorized: false };
  }
  return true;
})();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error', err);
});

export default pool;
