-- Fase 6j: CRUD mapel dan permission pengelolaan daftar mapel.
-- Idempotent: aman dijalankan ulang.

ALTER TABLE public.mapels DROP CONSTRAINT IF EXISTS mapels_code_check;
ALTER TABLE public.mapels DROP CONSTRAINT IF EXISTS categories_code_check;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE connamespace = 'public'::regnamespace
          AND conname = 'mapels_code_format'
    ) THEN
        ALTER TABLE public.mapels
            ADD CONSTRAINT mapels_code_format
            CHECK (code ~ '^[a-z][a-z0-9_-]{1,31}$');
    END IF;
END $$;

INSERT INTO permissions (code, description) VALUES
    ('mapels.manage', 'Kelola daftar mapel dan kodenya')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'mapels.manage'
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;
