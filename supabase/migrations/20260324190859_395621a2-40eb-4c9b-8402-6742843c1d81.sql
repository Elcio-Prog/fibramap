ALTER TABLE public.pre_viabilidades
  ADD COLUMN IF NOT EXISTS cnpj_cliente text,
  ADD COLUMN IF NOT EXISTS coordenadas text,
  ADD COLUMN IF NOT EXISTS endereco text;