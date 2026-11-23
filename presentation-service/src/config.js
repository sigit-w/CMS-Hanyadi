export const config = {
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 8083),
  writeKey: process.env.PRESENTATION_WRITE_KEY || null,
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 2000,
    statement_timeout: 5000
  }
};
