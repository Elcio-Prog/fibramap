-- Remove unique constraints - multiple records can share nr_contrato or id_etiqueta
ALTER TABLE public.compras_lm DROP CONSTRAINT IF EXISTS compras_lm_nr_contrato_unique;
ALTER TABLE public.compras_lm DROP CONSTRAINT IF EXISTS compras_lm_id_etiqueta_unique;