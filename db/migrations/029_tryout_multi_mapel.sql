-- Fase 6t / ADR-016: relasi many-to-many antara sesi tryout dan mapel.
-- Idempotent: aman dijalankan ulang. Kolom tryout_sessions.mapel_id tetap
-- dipertahankan hanya untuk kompatibilitas pembacaan klien lama.

CREATE TABLE IF NOT EXISTS public.tryout_session_mapels (
    session_id BIGINT NOT NULL REFERENCES public.tryout_sessions(id) ON DELETE CASCADE,
    mapel_id BIGINT NOT NULL REFERENCES public.mapels(id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, mapel_id)
);

CREATE INDEX IF NOT EXISTS idx_tryout_session_mapels_mapel
    ON public.tryout_session_mapels (mapel_id);

-- Backfill dari kolom lama yang masih menunjuk ke mapel yang ada.
INSERT INTO public.tryout_session_mapels (session_id, mapel_id)
SELECT s.id, s.mapel_id
FROM public.tryout_sessions s
JOIN public.mapels m ON m.id = s.mapel_id
WHERE s.mapel_id IS NOT NULL
ON CONFLICT (session_id, mapel_id) DO NOTHING;

-- Backfill mapel unik dari lembar soal yang terlampir pada sesi.
INSERT INTO public.tryout_session_mapels (session_id, mapel_id)
SELECT DISTINCT tss.session_id, sh.mapel_id
FROM public.tryout_session_sheets tss
JOIN public.question_sheets sh ON sh.id = tss.sheet_id
JOIN public.mapels m ON m.id = sh.mapel_id
ON CONFLICT (session_id, mapel_id) DO NOTHING;

DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT count(*)::INTEGER INTO orphan_count
    FROM public.tryout_sessions s
    WHERE NOT EXISTS (
        SELECT 1 FROM public.tryout_session_mapels tsm WHERE tsm.session_id = s.id
    );
    IF orphan_count > 0 THEN
        RAISE NOTICE 'tryout_session_mapels: % sesi tanpa mapel valid tidak memiliki baris junction', orphan_count;
    END IF;
END $$;

ALTER TABLE public.tryout_session_mapels OWNER TO bank_soal_user;
