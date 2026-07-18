import { Pool, PoolConfig } from 'pg';

// PostgreSQL connection pool
let pool: Pool | null = null;

export function getPostgresPool(): Pool {
  if (!pool) {
    const config: PoolConfig = {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DATABASE || 'zy_sales_trainer',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };
    
    pool = new Pool(config);
    
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }
  
  return pool;
}

export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = getPostgresPool();
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
  }
  
  return { rows: res.rows, rowCount: res.rowCount ?? 0 };
}

export async function getClient() {
  const pool = getPostgresPool();
  return pool.connect();
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    const { rows } = await query('SELECT 1');
    return rows.length > 0;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
