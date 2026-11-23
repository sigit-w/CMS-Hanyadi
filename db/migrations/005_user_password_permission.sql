-- Fase 6f: permission khusus untuk fitur ubah password pengguna.
-- Idempotent: aman dijalankan ulang.

INSERT INTO permissions (code, description) VALUES
    ('users.password.write', 'Ubah password pengguna')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'users.password.write'
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;
