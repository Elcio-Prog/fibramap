
ALTER TABLE public.equipamentos_valor
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS valor_dolar numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imposto numeric DEFAULT 0;

ALTER TABLE public.tabela_custos_pabx
  ADD COLUMN IF NOT EXISTS preco numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imposto numeric DEFAULT 0;
