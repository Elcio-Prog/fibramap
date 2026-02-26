
-- Add provider rules columns (all with safe defaults matching current behavior)
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS regras_usar_porta_disponivel boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS regras_considerar_ta boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS regras_considerar_ce boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regras_bloquear_splitter_1x2 boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS regras_bloquear_splitter_des boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS regras_bloquear_portas_livres_zero boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS regras_bloquear_atendimento_nao_sim boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS regras_habilitar_exclusao_cpfl boolean NOT NULL DEFAULT true;
