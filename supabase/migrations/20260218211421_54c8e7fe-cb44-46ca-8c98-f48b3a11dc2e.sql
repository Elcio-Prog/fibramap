
-- Add unique constraints for upsert to work
CREATE UNIQUE INDEX idx_compras_lm_id_etiqueta_unique ON public.compras_lm (id_etiqueta) WHERE id_etiqueta IS NOT NULL;
CREATE UNIQUE INDEX idx_compras_lm_nr_contrato_unique ON public.compras_lm (nr_contrato) WHERE nr_contrato IS NOT NULL;
