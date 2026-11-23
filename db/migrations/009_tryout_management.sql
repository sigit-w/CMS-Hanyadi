ALTER TABLE tryout_sessions
    ADD COLUMN IF NOT EXISTS mapel_id BIGINT REFERENCES mapels(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS tryout_session_questions (
    session_id BIGINT NOT NULL REFERENCES tryout_sessions(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (session_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_tryout_session_questions_question
    ON tryout_session_questions (question_id);

CREATE TABLE IF NOT EXISTS tryout_session_participants (
    session_id BIGINT NOT NULL REFERENCES tryout_sessions(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tryout_session_participants_user
    ON tryout_session_participants (user_id);

INSERT INTO permissions (code, description) VALUES
    ('tryouts.manage', 'Buat dan kelola Tryout beserta daftar soal dan peserta')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'tryouts.manage'
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;
