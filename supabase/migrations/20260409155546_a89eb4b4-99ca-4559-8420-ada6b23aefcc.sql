
-- 1. Add updated_at column
ALTER TABLE public.pre_viabilidades
  ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 2. Initialize updated_at for existing rows
UPDATE public.pre_viabilidades SET updated_at = created_at WHERE updated_at IS NULL;

-- 3. Create trigger to auto-update updated_at on every UPDATE
CREATE TRIGGER update_pre_viabilidades_updated_at
  BEFORE UPDATE ON public.pre_viabilidades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Fix all rows where numero = 0 by assigning sequential values
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.pre_viabilidades WHERE numero = 0 ORDER BY created_at ASC
  LOOP
    UPDATE public.pre_viabilidades
      SET numero = nextval('pre_viabilidades_numero_seq')
      WHERE id = r.id;
  END LOOP;
END;
$$;
