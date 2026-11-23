import { config } from '../src/config.js';
import { hashPassword } from '../src/auth.js';
import { query, pool, withTransaction } from '../src/db.js';

const username = process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin';
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL || null;

if (!password || password.length < 12) {
  throw new Error('BOOTSTRAP_ADMIN_PASSWORD wajib diset minimal 12 karakter');
}
if (!config.auth.jwtSecret || config.auth.jwtSecret.length < 32) {
  throw new Error('AUTH_JWT_SECRET wajib diset minimal 32 karakter');
}

const passwordHash = await hashPassword(password);

const result = await withTransaction(async (client) => {
  const user = await client.query(
    `INSERT INTO contributors (username, display_name, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, 'admin', true)
     ON CONFLICT (username) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       email = COALESCE(EXCLUDED.email, contributors.email),
       password_hash = EXCLUDED.password_hash,
       role = 'admin',
       is_active = true
     RETURNING id, username`,
    [username, 'Administrator', email, passwordHash]
  );
  const userId = user.rows[0].id;
  await client.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE code = 'admin'
     ON CONFLICT DO NOTHING`,
    [userId]
  );
  return user.rows[0];
});

console.log(`Admin bootstrap siap: ${result.username} (id ${result.id}). Password tidak ditampilkan.`);
await pool.end();
