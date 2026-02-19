
-- Drop partial unique indexes that don't work with PostgREST upsert
DROP INDEX IF EXISTS idx_compras_lm_id_etiqueta_unique;
DROP INDEX IF EXISTS idx_compras_lm_nr_contrato_unique;

-- Add proper UNIQUE constraints (PostgreSQL allows multiple NULLs in unique constraints)
ALTER TABLE public.compras_lm ADD CONSTRAINT compras_lm_id_etiqueta_unique UNIQUE (id_etiqueta);
ALTER TABLE public.compras_lm ADD CONSTRAINT compras_lm_nr_contrato_unique UNIQUE (nr_contrato);
