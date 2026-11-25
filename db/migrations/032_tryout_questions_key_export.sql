-- Fase 6x / ADR-020: permission khusus ekspor soal beserta kunci jawaban.
-- Idempotent. Tidak menambahkan role_permissions: role lama tidak otomatis mendapat hak ini.

INSERT INTO public.permissions (code, description)
VALUES ('tryout_questions.key_export', 'Unduh soal tryout beserta kunci jawaban dalam bentuk PDF')
ON CONFLICT (code) DO UPDATE
  SET description = EXCLUDED.description;
