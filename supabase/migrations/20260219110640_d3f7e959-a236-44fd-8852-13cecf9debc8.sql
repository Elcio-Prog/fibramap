-- Add unique index on endereco for upsert support
CREATE UNIQUE INDEX IF NOT EXISTS compras_lm_endereco_unique ON public.compras_lm (endereco);
