-- Fase 6w / ADR-019: master jenjang pendidikan, jenjang & username peserta.
-- Idempotent: aman dijalankan ulang.

CREATE TABLE IF NOT EXISTS public.jenjang (
  id BIGSERIAL PRIMARY KEY,
  kode VARCHAR(8) NOT NULL,
  nama VARCHAR(64) NOT NULL,
  deskripsi TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT jenjang_kode_key UNIQUE (kode)
);

INSERT INTO public.jenjang (kode, nama, deskripsi, is_active)
VALUES
  ('SD', 'SD', 'Sekolah Dasar', true),
  ('SMP', 'SMP', 'Sekolah Menengah Pertama', true),
  ('SMA', 'SMA', 'Sekolah Menengah Atas', true)
ON CONFLICT (kode) DO UPDATE
  SET nama = EXCLUDED.nama,
      deskripsi = COALESCE(public.jenjang.deskripsi, EXCLUDED.deskripsi),
      is_active = true;

ALTER TABLE public.siswa
  ADD COLUMN IF NOT EXISTS jenjang_id BIGINT REFERENCES public.jenjang(id) ON DELETE SET NULL;
ALTER TABLE public.prospektus
  ADD COLUMN IF NOT EXISTS jenjang_id BIGINT REFERENCES public.jenjang(id) ON DELETE SET NULL;
ALTER TABLE public.siswa ADD COLUMN IF NOT EXISTS username VARCHAR(32);
ALTER TABLE public.prospektus ADD COLUMN IF NOT EXISTS username VARCHAR(32);

CREATE INDEX IF NOT EXISTS idx_siswa_jenjang ON public.siswa (jenjang_id);
CREATE INDEX IF NOT EXISTS idx_prospektus_jenjang ON public.prospektus (jenjang_id);
CREATE INDEX IF NOT EXISTS idx_siswa_username ON public.siswa (lower(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospektus_username ON public.prospektus (lower(username)) WHERE username IS NOT NULL;

DROP VIEW IF EXISTS public.v_cbt_attempt_report;
DROP VIEW IF EXISTS public.tryout_participants;

CREATE VIEW public.tryout_participants AS
SELECT s.id, s.nama, s.jenis, s.email, s.password_hash, s.pin_hash,
       s.password_plain, s.pin_plain, s.is_active, s.failed_login_count,
       s.locked_until, s.last_login_at, s.kelas, s.sekolah,
       s.program_belajar_id, s.wa_orang_tua, s.jenjang_id,
       j.kode AS jenjang_kode, j.nama AS jenjang_nama, s.username,
       s.prospek, s.prospek_at,
       false::boolean AS bergabung, NULL::timestamptz AS bergabung_at,
       s.created_at, s.updated_at
FROM public.siswa s
LEFT JOIN public.jenjang j ON j.id = s.jenjang_id
UNION ALL
SELECT p.id, p.nama, p.jenis, p.email, p.password_hash, p.pin_hash,
       p.password_plain, p.pin_plain, p.is_active, p.failed_login_count,
       p.locked_until, p.last_login_at, p.kelas, p.sekolah,
       p.program_belajar_id, p.wa_orang_tua, p.jenjang_id,
       j.kode AS jenjang_kode, j.nama AS jenjang_nama, p.username,
       p.prospek, p.prospek_at, p.bergabung, p.bergabung_at,
       p.created_at, p.updated_at
FROM public.prospektus p
LEFT JOIN public.jenjang j ON j.id = p.jenjang_id;

CREATE OR REPLACE FUNCTION public.tryout_participants_view_delete() RETURNS trigger AS $$
BEGIN
  DELETE FROM public.siswa WHERE id = OLD.id;
  DELETE FROM public.prospektus WHERE id = OLD.id;
  RETURN OLD;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tryout_participants_view_delete ON public.tryout_participants;
CREATE TRIGGER trg_tryout_participants_view_delete
INSTEAD OF DELETE ON public.tryout_participants
FOR EACH ROW EXECUTE FUNCTION public.tryout_participants_view_delete();

CREATE OR REPLACE VIEW public.v_cbt_attempt_report AS
WITH scores AS (
  SELECT a.id AS attempt_id,
         count(s.id) AS question_count,
         count(s.id) FILTER (WHERE s.is_correct) AS correct_count,
         CASE WHEN count(s.id) = 0 THEN 0
              ELSE round(100.0 * count(s.id) FILTER (WHERE s.is_correct) / count(s.id), 2)
         END AS score
  FROM public.tryout_attempts a
  LEFT JOIN public.tryout_submissions s
    ON s.participant_id = a.participant_id
   AND s.session_id = a.session_id
   AND s.version = 'v1'
  GROUP BY a.id
)
SELECT a.id AS attempt_id,
       a.session_id,
       ts.name AS session_name,
       a.participant_id,
       p.nama AS participant,
       p.kelas,
       p.sekolah,
       a.seed,
       a.started_at,
       a.deadline_at,
       a.submitted_at,
       a.status,
       a.violation_count,
       coalesce(sc.question_count, 0) AS question_count,
       coalesce(sc.correct_count, 0) AS correct_count,
       sc.score
FROM public.tryout_attempts a
JOIN public.tryout_sessions ts ON ts.id = a.session_id
LEFT JOIN public.tryout_participants p ON p.id = a.participant_id
LEFT JOIN scores sc ON sc.attempt_id = a.id;

ALTER TABLE public.jenjang OWNER TO bank_soal_user;
ALTER SEQUENCE public.jenjang_id_seq OWNER TO bank_soal_user;
ALTER VIEW public.tryout_participants OWNER TO bank_soal_user;
ALTER VIEW public.v_cbt_attempt_report OWNER TO bank_soal_user;
