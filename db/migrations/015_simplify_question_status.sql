UPDATE public.questions
SET status = 'approved'
WHERE status IN ('draft', 'review');

ALTER TABLE public.questions ALTER COLUMN status SET DEFAULT 'approved';

DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.conrelid = 'public.questions'::regclass
          AND c.contype = 'c'
          AND a.attname = 'status'
          AND c.conname <> 'questions_status_check'
    LOOP
        EXECUTE format('ALTER TABLE public.questions DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_status_check;
ALTER TABLE public.questions ADD CONSTRAINT questions_status_check
    CHECK (status IN ('approved', 'rejected', 'archived'));
