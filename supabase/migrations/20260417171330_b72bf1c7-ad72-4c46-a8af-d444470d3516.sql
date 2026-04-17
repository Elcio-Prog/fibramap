-- Drop tabela antiga e cria lm_contracts com schema novo + campos legados (lat/lng/geocoding) preservados para Base LM
DROP TABLE IF EXISTS public.compras_lm CASCADE;

CREATE TABLE public.lm_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,

  -- Identificação / Contrato
  status TEXT NOT NULL DEFAULT 'Novo - A instalar',
  pn TEXT,
  nome_pn TEXT,
  grupo TEXT,
  recorrencia TEXT,
  cont_guarda_chuva TEXT,
  modelo_tr TEXT,
  valor_mensal_tr NUMERIC NOT NULL DEFAULT 0,
  observacao_contrato_lm TEXT,
  item_sap TEXT,
  protocolo_elleven TEXT,
  nome_cliente TEXT,
  etiqueta TEXT,
  num_contrato_cliente TEXT,
  endereco_instalacao TEXT NOT NULL DEFAULT '',

  -- Datas / Vigência
  data_assinatura DATE,
  vigencia_meses INTEGER,
  data_termino DATE,

  -- Flags
  is_last_mile BOOLEAN NOT NULL DEFAULT true,
  simples_nacional BOOLEAN NOT NULL DEFAULT false,
  observacao_geral TEXT,

  -- Acesso ao portal
  site_portal TEXT,
  login TEXT,
  senha TEXT,

  -- Campos legados (preservados para Base LM: análise por raio, mapa, geocoding)
  cidade TEXT,
  uf TEXT,
  lat NUMERIC,
  lng NUMERIC,
  geocoding_status TEXT NOT NULL DEFAULT 'pending',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX lm_contracts_num_contrato_cliente_unique
  ON public.lm_contracts (num_contrato_cliente)
  WHERE num_contrato_cliente IS NOT NULL AND num_contrato_cliente <> '';

CREATE INDEX lm_contracts_data_termino_idx ON public.lm_contracts (data_termino);
CREATE INDEX lm_contracts_status_idx ON public.lm_contracts (status);
CREATE INDEX lm_contracts_pn_idx ON public.lm_contracts (pn);

ALTER TABLE public.lm_contracts ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer autenticado
CREATE POLICY "Authenticated can read lm_contracts"
  ON public.lm_contracts FOR SELECT
  TO authenticated
  USING (true);

-- Escrita: admin
CREATE POLICY "Admins can insert lm_contracts"
  ON public.lm_contracts FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update lm_contracts"
  ON public.lm_contracts FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete lm_contracts"
  ON public.lm_contracts FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Escrita: lm
CREATE POLICY "LM can insert lm_contracts"
  ON public.lm_contracts FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'lm'::app_role));

CREATE POLICY "LM can update lm_contracts"
  ON public.lm_contracts FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'lm'::app_role))
  WITH CHECK (has_role(auth.uid(), 'lm'::app_role));

CREATE POLICY "LM can delete lm_contracts"
  ON public.lm_contracts FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'lm'::app_role));

-- Trigger updated_at
CREATE TRIGGER lm_contracts_set_updated_at
  BEFORE UPDATE ON public.lm_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();