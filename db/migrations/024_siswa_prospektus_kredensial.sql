DO $$
BEGIN
  IF to_regclass('public.tryout_participants') IS NOT NULL
     AND to_regclass('public.siswa') IS NULL THEN
    ALTER TABLE public.tryout_participants RENAME TO siswa;
  END IF;
END $$;

ALTER TABLE public.auth_sessions
  DROP CONSTRAINT IF EXISTS auth_sessions_participant_id_fkey;
ALTER TABLE public.tryout_submissions
  DROP CONSTRAINT IF EXISTS tryout_submissions_participant_id_fkey;
ALTER TABLE public.tryout_session_participants
  DROP CONSTRAINT IF EXISTS tryout_session_participants_participant_id_fkey;

ALTER TABLE public.siswa ADD COLUMN IF NOT EXISTS password_plain TEXT;
ALTER TABLE public.siswa ADD COLUMN IF NOT EXISTS pin_plain TEXT;

CREATE TABLE IF NOT EXISTS public.prospektus (
  id BIGINT PRIMARY KEY,
  nama VARCHAR(128) NOT NULL,
  jenis VARCHAR(16) NOT NULL DEFAULT 'umum',
  email VARCHAR(255),
  password_hash TEXT,
  pin_hash TEXT,
  password_plain TEXT,
  pin_plain TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  kelas INTEGER NOT NULL DEFAULT 0,
  sekolah VARCHAR(255) NOT NULL,
  program_belajar_id BIGINT REFERENCES public.program_belajar(id) ON DELETE SET NULL,
  wa_orang_tua VARCHAR(20),
  prospek BOOLEAN NOT NULL DEFAULT false,
  prospek_at TIMESTAMPTZ,
  bergabung BOOLEAN NOT NULL DEFAULT false,
  bergabung_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT prospektus_jenis_check CHECK (jenis = 'umum'),
  CONSTRAINT prospektus_kelas_check CHECK (kelas >= 0 AND kelas <= 100),
  CONSTRAINT prospektus_wa_format CHECK (
    wa_orang_tua IS NULL OR wa_orang_tua::text ~ '^\+?[0-9][0-9 -]{6,18}$'
  ),
  CONSTRAINT prospektus_pin_format CHECK (
    pin_hash IS NULL OR pin_hash LIKE 'scrypt$16384$8$1$%'
  )
);

DO $$
BEGIN
  EXECUTE format(
    'ALTER TABLE public.prospektus ALTER COLUMN id SET DEFAULT nextval(%L)',
    pg_get_serial_sequence('public.siswa', 'id')
  );
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_prospektus_nama
  ON public.prospektus (lower(nama)) WHERE jenis = 'umum';
CREATE UNIQUE INDEX IF NOT EXISTS uq_prospektus_email
  ON public.prospektus (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospektus_active ON public.prospektus (is_active);
CREATE INDEX IF NOT EXISTS idx_prospektus_bergabung
  ON public.prospektus (bergabung) WHERE NOT bergabung;
CREATE INDEX IF NOT EXISTS idx_prospektus_prospek
  ON public.prospektus (prospek) WHERE prospek;

DROP TRIGGER IF EXISTS trg_prospektus_updated_at ON public.prospektus;
CREATE TRIGGER trg_prospektus_updated_at
BEFORE UPDATE ON public.prospektus
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO public.prospektus (
  id, nama, jenis, email, password_hash, pin_hash, password_plain, pin_plain,
  is_active, failed_login_count, locked_until, last_login_at, kelas, sekolah,
  program_belajar_id, wa_orang_tua, prospek, prospek_at, created_at, updated_at
)
SELECT
  id, nama, jenis, email, password_hash, pin_hash, password_plain, pin_plain,
  is_active, failed_login_count, locked_until, last_login_at, kelas, sekolah,
  program_belajar_id, wa_orang_tua, prospek, prospek_at, created_at, updated_at
FROM public.siswa
WHERE jenis = 'umum'
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.siswa WHERE jenis = 'umum';

CREATE OR REPLACE FUNCTION public.assert_participant_exists() RETURNS trigger AS $$
BEGIN
  IF NEW.participant_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.siswa WHERE id = NEW.participant_id)
     AND NOT EXISTS (SELECT 1 FROM public.prospektus WHERE id = NEW.participant_id) THEN
    RAISE EXCEPTION 'participant_id % tidak ditemukan', NEW.participant_id
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.cascade_participant_delete() RETURNS trigger AS $$
BEGIN
  DELETE FROM public.auth_sessions WHERE participant_id = OLD.id;
  DELETE FROM public.tryout_submissions WHERE participant_id = OLD.id;
  DELETE FROM public.tryout_session_participants WHERE participant_id = OLD.id;
  RETURN OLD;
END $$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['auth_sessions', 'tryout_submissions', 'tryout_session_participants'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_participant_ref ON public.%1$s', t);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_participant_ref BEFORE INSERT OR UPDATE OF participant_id ON public.%1$s
       FOR EACH ROW EXECUTE FUNCTION public.assert_participant_exists()', t
    );
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_siswa_participant_delete ON public.siswa;
CREATE TRIGGER trg_siswa_participant_delete
AFTER DELETE ON public.siswa
FOR EACH ROW EXECUTE FUNCTION public.cascade_participant_delete();

DROP TRIGGER IF EXISTS trg_prospektus_participant_delete ON public.prospektus;
CREATE TRIGGER trg_prospektus_participant_delete
AFTER DELETE ON public.prospektus
FOR EACH ROW EXECUTE FUNCTION public.cascade_participant_delete();

DROP VIEW IF EXISTS public.tryout_participants;

CREATE VIEW public.tryout_participants AS
SELECT id, nama, jenis, email, password_hash, pin_hash, password_plain, pin_plain,
       is_active, failed_login_count, locked_until, last_login_at, kelas, sekolah,
       program_belajar_id, wa_orang_tua, prospek, prospek_at,
       false::boolean AS bergabung, NULL::timestamptz AS bergabung_at,
       created_at, updated_at
FROM public.siswa
UNION ALL
SELECT id, nama, jenis, email, password_hash, pin_hash, password_plain, pin_plain,
       is_active, failed_login_count, locked_until, last_login_at, kelas, sekolah,
       program_belajar_id, wa_orang_tua, prospek, prospek_at,
       bergabung, bergabung_at, created_at, updated_at
FROM public.prospektus;

CREATE OR REPLACE FUNCTION public.tryout_participants_view_delete() RETURNS trigger AS $$
BEGIN
  DELETE FROM public.siswa WHERE id = OLD.id;
  DELETE FROM public.prospektus WHERE id = OLD.id;
  RETURN OLD;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tryout_participants_view_delete
INSTEAD OF DELETE ON public.tryout_participants
FOR EACH ROW EXECUTE FUNCTION public.tryout_participants_view_delete();
