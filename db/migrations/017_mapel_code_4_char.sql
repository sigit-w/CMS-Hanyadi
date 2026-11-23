-- Fase 6l amendemen D6: kode mapel tepat 4 karakter kapital dan dipakai sebagai prefix lembar soal.
-- Idempotent: aman dijalankan ulang.

ALTER TABLE public.mapels DROP CONSTRAINT IF EXISTS mapels_code_format;
ALTER TABLE public.mapels DROP CONSTRAINT IF EXISTS mapels_code_4_char;

UPDATE public.mapels SET code = 'MTKA' WHERE code = 'matematika';
UPDATE public.mapels SET code = 'BIND' WHERE code = 'bahasa_indonesia';
UPDATE public.mapels SET code = 'IPAS' WHERE code = 'ipas';

ALTER TABLE public.mapels
    ADD CONSTRAINT mapels_code_4_char
    CHECK (code ~ '^[A-Z0-9]{4}$');
