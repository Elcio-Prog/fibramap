-- Add sequential numero column to lm_contracts
ALTER TABLE public.lm_contracts
ADD COLUMN IF NOT EXISTS numero integer;

-- Create sequence
CREATE SEQUENCE IF NOT EXISTS public.lm_contracts_numero_seq;

-- Backfill existing rows (ordered by created_at)
DO $$
DECLARE
  r record;
  i integer := 0;
BEGIN
  FOR r IN SELECT id FROM public.lm_contracts WHERE numero IS NULL ORDER BY created_at ASC LOOP
    i := nextval('public.lm_contracts_numero_seq')::integer;
    UPDATE public.lm_contracts SET numero = i WHERE id = r.id;
  END LOOP;
END $$;

-- Set default to use sequence and make NOT NULL + UNIQUE
ALTER TABLE public.lm_contracts
ALTER COLUMN numero SET DEFAULT nextval('public.lm_contracts_numero_seq'::regclass);

ALTER TABLE public.lm_contracts
ALTER COLUMN numero SET NOT NULL;

ALTER SEQUENCE public.lm_contracts_numero_seq OWNED BY public.lm_contracts.numero;

CREATE UNIQUE INDEX IF NOT EXISTS lm_contracts_numero_key ON public.lm_contracts(numero);