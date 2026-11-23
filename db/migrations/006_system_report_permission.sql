-- Fase 6g: permission untuk melihat laporan kondisi sistem di CMS.
-- Default: hanya role admin yang memilikinya. Idempotent: aman dijalankan ulang.

INSERT INTO permissions (code, description) VALUES
    ('reports.read', 'Lihat laporan kondisi sistem')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'reports.read'
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;
