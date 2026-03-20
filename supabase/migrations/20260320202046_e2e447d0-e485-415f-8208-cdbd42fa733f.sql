
ALTER TABLE public.custos_voz_pais
  ADD COLUMN IF NOT EXISTS custo_minuto numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carga_tributaria numeric DEFAULT 0;
