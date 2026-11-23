CREATE TABLE IF NOT EXISTS tryout_sessions (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    session_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tryout_sessions_active
    ON tryout_sessions ((is_active)) WHERE is_active;

ALTER TABLE tryout_submissions
    ADD COLUMN IF NOT EXISTS session_id BIGINT REFERENCES tryout_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tryout_submissions_session_user
    ON tryout_submissions (session_id, user_id);

INSERT INTO tryout_sessions (name, session_date, is_active)
SELECT 'Sesi Default', CURRENT_DATE, true
WHERE NOT EXISTS (SELECT 1 FROM tryout_sessions);

UPDATE tryout_submissions
SET session_id = (SELECT id FROM tryout_sessions WHERE is_active ORDER BY id DESC LIMIT 1)
WHERE session_id IS NULL;

INSERT INTO permissions (code, description) VALUES
    ('tryout_reports.read', 'Lihat laporan hasil tryout dan kunci jawaban')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'tryout_reports.read'
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;
