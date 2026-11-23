ALTER TABLE tryout_participants
    ADD COLUMN IF NOT EXISTS kelas INTEGER NOT NULL DEFAULT 0;

ALTER TABLE tryout_participants
    ADD COLUMN IF NOT EXISTS sekolah VARCHAR(255) NOT NULL DEFAULT '';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tryout_participants_kelas_check'
          AND conrelid = 'tryout_participants'::regclass
    ) THEN
        ALTER TABLE tryout_participants
            ADD CONSTRAINT tryout_participants_kelas_check CHECK (kelas >= 0 AND kelas <= 100);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tryout_participants_kelas ON tryout_participants (kelas);
CREATE INDEX IF NOT EXISTS idx_tryout_participants_sekolah ON tryout_participants (sekolah);
