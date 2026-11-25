-- Hapus role CMS bawaan yang tidak dipakai: editor, validator, viewer.
-- Idempotent. user_roles dan role_permissions ikut terhapus melalui ON DELETE CASCADE.

DELETE FROM public.roles
WHERE code IN ('editor', 'validator', 'viewer');
