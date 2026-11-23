-- Fase 6: autentikasi dan manajemen role (ADR-001, disetujui QA-11).
-- Idempotent: aman dijalankan ulang.

ALTER TABLE contributors
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS password_hash TEXT,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contributors_email
    ON contributors (lower(email)) WHERE email IS NOT NULL;

-- Role sekarang dinamis lewat tabel roles; kolom lama hanya dipakai sebagai kompatibilitas.
ALTER TABLE contributors DROP CONSTRAINT IF EXISTS contributors_role_check;
ALTER TABLE contributors DROP CONSTRAINT IF EXISTS contributors_role_format;
ALTER TABLE contributors ADD CONSTRAINT contributors_role_format
    CHECK (length(btrim(role)) > 0 AND length(role) <= 32);

CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(64) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by BIGINT REFERENCES contributors(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
    refresh_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh ON auth_sessions (refresh_hash);

DROP TRIGGER IF EXISTS trg_roles_updated_at ON roles;
CREATE TRIGGER trg_roles_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

INSERT INTO roles (code, name, description, is_system) VALUES
    ('admin', 'Administrator', 'Akses penuh CMS dan manajemen role', true),
    ('editor', 'Editor Soal', 'Buat, ubah, arsipkan, dan import soal', true),
    ('validator', 'Validator', 'Review soal dan menandai kesiapan versi', true),
    ('viewer', 'Pembaca', 'Lihat dashboard dan daftar soal saja', true),
    ('peserta', 'Peserta Tryout', 'Akses tryout dan pembahasan', true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system = true;

INSERT INTO permissions (code, description) VALUES
    ('cms.access', 'Akses dashboard CMS'),
    ('questions.read', 'Lihat daftar dan detail soal'),
    ('questions.write', 'Buat, ubah, arsipkan, dan import soal'),
    ('questions.review', 'Review status dan kunci jawaban'),
    ('readiness.write', 'Tandai kesiapan v1/v2/v3'),
    ('roles.manage', 'Kelola role dan penugasan pengguna'),
    ('tryout.access', 'Akses halaman tryout'),
    ('presentation.read', 'Baca variasi penyajian soal'),
    ('users.read', 'Lihat daftar pengguna CMS')
ON CONFLICT (code) DO NOTHING;

DELETE FROM role_permissions;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code = ANY(CASE r.code
  WHEN 'admin' THEN ARRAY[
    'cms.access', 'questions.read', 'questions.write', 'questions.review',
    'readiness.write', 'roles.manage', 'tryout.access', 'presentation.read', 'users.read'
  ]
  WHEN 'editor' THEN ARRAY['cms.access', 'questions.read', 'questions.write', 'tryout.access', 'presentation.read']
  WHEN 'validator' THEN ARRAY['cms.access', 'questions.read', 'questions.review', 'readiness.write', 'tryout.access', 'presentation.read']
  WHEN 'viewer' THEN ARRAY['cms.access', 'questions.read', 'tryout.access', 'presentation.read']
  WHEN 'peserta' THEN ARRAY['tryout.access', 'presentation.read']
  ELSE ARRAY[]::text[]
END)
WHERE r.code IN ('admin', 'editor', 'validator', 'viewer', 'peserta');

-- Kompatibilitas: kolom lama contributors.role mengikuti role utama saat seed admin dibuat.
