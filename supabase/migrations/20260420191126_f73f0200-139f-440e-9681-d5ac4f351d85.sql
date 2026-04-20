
-- Add new distance columns
ALTER TABLE public.pre_viabilidades
  ADD COLUMN IF NOT EXISTS distancia_sistema numeric,
  ADD COLUMN IF NOT EXISTS distancia_projetista numeric,
  ADD COLUMN IF NOT EXISTS variancia_distancia numeric;

-- Trigger to auto-calculate variancia when distancia_projetista changes
CREATE OR REPLACE FUNCTION public.calc_variancia_distancia()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.distancia_projetista IS NOT NULL AND NEW.distancia_sistema IS NOT NULL THEN
    NEW.variancia_distancia := NEW.distancia_projetista - NEW.distancia_sistema;
  ELSE
    NEW.variancia_distancia := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calc_variancia_distancia
  BEFORE INSERT OR UPDATE OF distancia_projetista, distancia_sistema
  ON public.pre_viabilidades
  FOR EACH ROW
  EXECUTE FUNCTION public.calc_variancia_distancia();
