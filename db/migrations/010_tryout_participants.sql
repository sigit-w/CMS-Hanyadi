CREATE TABLE IF NOT EXISTS tryout_participants (
    id BIGSERIAL PRIMARY KEY,
    nama VARCHAR(128) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tryout_participants_email ON tryout_participants (lower(email));

CREATE INDEX IF NOT EXISTS idx_tryout_participants_active ON tryout_participants (is_active);

DROP TRIGGER IF EXISTS trg_tryout_participants_updated_at ON tryout_participants;
CREATE TRIGGER trg_tryout_participants_updated_at
BEFORE UPDATE ON tryout_participants
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

INSERT INTO tryout_participants (nama, email, password_hash, is_active, failed_login_count, locked_until, last_login_at)
SELECT c.display_name,
       coalesce(c.email, c.username || '@local.invalid'),
       coalesce(c.password_hash, md5(c.username || clock_timestamp()::text)),
       c.is_active,
       c.failed_login_count,
       c.locked_until,
       c.last_login_at
FROM contributors c
WHERE EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = c.id AND r.code = 'peserta'
)
AND NOT EXISTS (
    SELECT 1 FROM tryout_participants tp
    WHERE lower(tp.email) = lower(coalesce(c.email, c.username || '@local.invalid'))
);

DROP TABLE IF EXISTS tmp_tryout_participant_map;
CREATE TEMP TABLE tmp_tryout_participant_map AS
SELECT c.id AS user_id, tp.id AS participant_id
FROM contributors c
JOIN tryout_participants tp
  ON lower(tp.email) = lower(coalesce(c.email, c.username || '@local.invalid'))
WHERE EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = c.id AND r.code = 'peserta'
);

ALTER TABLE tryout_session_participants
    ADD COLUMN IF NOT EXISTS participant_id BIGINT REFERENCES tryout_participants(id) ON DELETE CASCADE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tryout_session_participants' AND column_name = 'user_id'
    ) THEN
        UPDATE tryout_session_participants jp
        SET participant_id = m.participant_id
        FROM tmp_tryout_participant_map m
        WHERE jp.user_id = m.user_id AND jp.participant_id IS NULL;
        DELETE FROM tryout_session_participants WHERE participant_id IS NULL;
        ALTER TABLE tryout_session_participants DROP CONSTRAINT IF EXISTS tryout_session_participants_pkey;
        DROP INDEX IF EXISTS idx_tryout_session_participants_user;
        ALTER TABLE tryout_session_participants DROP COLUMN user_id;
    END IF;
END $$;

ALTER TABLE tryout_session_participants ALTER COLUMN participant_id SET NOT NULL;
ALTER TABLE tryout_session_participants DROP CONSTRAINT IF EXISTS tryout_session_participants_pkey;
ALTER TABLE tryout_session_participants
    ADD CONSTRAINT tryout_session_participants_pkey PRIMARY KEY (session_id, participant_id);
CREATE INDEX IF NOT EXISTS idx_tryout_session_participants_participant
    ON tryout_session_participants (participant_id);

ALTER TABLE tryout_submissions
    ADD COLUMN IF NOT EXISTS participant_id BIGINT REFERENCES tryout_participants(id) ON DELETE CASCADE;

ALTER TABLE tryout_submissions ALTER COLUMN user_id DROP NOT NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tryout_submissions' AND column_name = 'user_id'
    ) THEN
        UPDATE tryout_submissions ts
        SET user_id = NULL, participant_id = m.participant_id
        FROM tmp_tryout_participant_map m
        WHERE ts.user_id = m.user_id AND ts.participant_id IS NULL;
    END IF;
END $$;

ALTER TABLE tryout_submissions DROP CONSTRAINT IF EXISTS tryout_submissions_owner_check;
ALTER TABLE tryout_submissions ADD CONSTRAINT tryout_submissions_owner_check
    CHECK (num_nonnulls(user_id, participant_id) = 1);
DROP INDEX IF EXISTS uq_tryout_submissions_participant;
CREATE UNIQUE INDEX uq_tryout_submissions_participant
    ON tryout_submissions (participant_id, question_id, version)
    WHERE participant_id IS NOT NULL;

ALTER TABLE auth_sessions
    ADD COLUMN IF NOT EXISTS participant_id BIGINT REFERENCES tryout_participants(id) ON DELETE CASCADE;

ALTER TABLE auth_sessions ALTER COLUMN user_id DROP NOT NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'auth_sessions' AND column_name = 'user_id'
    ) THEN
        UPDATE auth_sessions s
        SET user_id = NULL, participant_id = m.participant_id
        FROM tmp_tryout_participant_map m
        WHERE s.user_id = m.user_id AND s.participant_id IS NULL;
    END IF;
END $$;

ALTER TABLE auth_sessions DROP CONSTRAINT IF EXISTS auth_sessions_owner_check;
ALTER TABLE auth_sessions ADD CONSTRAINT auth_sessions_owner_check
    CHECK (num_nonnulls(user_id, participant_id) = 1);
CREATE INDEX IF NOT EXISTS idx_sessions_participant ON auth_sessions (participant_id);

DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE code = 'peserta');
DELETE FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE code = 'peserta');
UPDATE roles SET is_active = false WHERE code = 'peserta';
