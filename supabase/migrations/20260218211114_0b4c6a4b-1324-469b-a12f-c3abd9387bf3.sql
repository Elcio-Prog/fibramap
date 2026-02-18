
-- Tabela principal de compras/vendas LM
CREATE TABLE public.compras_lm (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  parceiro TEXT NOT NULL,
  cliente TEXT,
  endereco TEXT NOT NULL,
  cidade TEXT,
  uf TEXT,
  id_etiqueta TEXT,
  nr_contrato TEXT,
  banda_mbps NUMERIC,
  valor_mensal NUMERIC NOT NULL,
  setup NUMERIC,
  data_inicio DATE,
  data_fim DATE,
  status TEXT NOT NULL DEFAULT 'Em ativação',
  observacoes TEXT,
  codigo_sap TEXT,
  lat NUMERIC,
  lng NUMERIC,
  geocoding_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_compras_lm_parceiro ON public.compras_lm (parceiro);
CREATE INDEX idx_compras_lm_id_etiqueta ON public.compras_lm (id_etiqueta);
CREATE INDEX idx_compras_lm_nr_contrato ON public.compras_lm (nr_contrato);
CREATE INDEX idx_compras_lm_lat_lng ON public.compras_lm (lat, lng);
CREATE INDEX idx_compras_lm_status ON public.compras_lm (status);

-- RLS
ALTER TABLE public.compras_lm ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON public.compras_lm
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER update_compras_lm_updated_at
  BEFORE UPDATE ON public.compras_lm
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de perfis de importação
CREATE TABLE public.import_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  key_field TEXT NOT NULL DEFAULT 'id_etiqueta',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.import_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON public.import_profiles
  FOR ALL USING (true) WITH CHECK (true);
