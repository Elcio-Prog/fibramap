ALTER TABLE public.lm_contracts
  ALTER COLUMN endereco_instalacao DROP NOT NULL,
  ALTER COLUMN endereco_instalacao DROP DEFAULT,
  ALTER COLUMN valor_mensal_tr DROP NOT NULL,
  ALTER COLUMN valor_mensal_tr DROP DEFAULT;