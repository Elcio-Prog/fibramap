
-- Add versioning and metadata to ws_batches
ALTER TABLE public.ws_batches 
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_batch_id uuid REFERENCES public.ws_batches(id),
  ADD COLUMN IF NOT EXISTS processed_items integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_items integer NOT NULL DEFAULT 0;

-- Add new user-input fields and observações to ws_feasibility_items
ALTER TABLE public.ws_feasibility_items
  ADD COLUMN IF NOT EXISTS vigencia text,
  ADD COLUMN IF NOT EXISTS taxa_instalacao numeric,
  ADD COLUMN IF NOT EXISTS bloco_ip text,
  ADD COLUMN IF NOT EXISTS cnpj_cliente text,
  ADD COLUMN IF NOT EXISTS tipo_solicitacao text,
  ADD COLUMN IF NOT EXISTS valor_a_ser_vendido numeric,
  ADD COLUMN IF NOT EXISTS codigo_smark text,
  ADD COLUMN IF NOT EXISTS observacoes_system text,
  ADD COLUMN IF NOT EXISTS observacoes_user text,
  ADD COLUMN IF NOT EXISTS observacoes_user_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message text;
