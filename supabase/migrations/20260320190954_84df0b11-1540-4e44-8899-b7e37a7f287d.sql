
-- Create all 7 pricing reference tables

CREATE TABLE public.custo_por_mega (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificacao text NOT NULL UNIQUE,
  valor_link numeric(12,6) DEFAULT 0,
  valor_ptt numeric(12,6) DEFAULT 0,
  valor_l2l numeric(12,6) DEFAULT 0,
  valor_link_full numeric(12,6) DEFAULT 0,
  valor_link_flex numeric(12,6) DEFAULT 0,
  valor_link_empresa numeric(12,6) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.taxas_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificacao text NOT NULL UNIQUE,
  margem_lucro numeric(8,6) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.valor_bloco_ip (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificacao text NOT NULL UNIQUE,
  valor numeric(12,6) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.equipamentos_valor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento text NOT NULL UNIQUE,
  valor_final numeric(12,6) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.tabela_custos_pabx (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador text NOT NULL UNIQUE,
  preco_final numeric(12,6) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.custo_voz_geral (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL UNIQUE,
  custo_minuto numeric(12,6) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.custos_voz_pais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pais text NOT NULL UNIQUE,
  custo_final numeric(12,6) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.custo_por_mega ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxas_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valor_bloco_ip ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipamentos_valor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabela_custos_pabx ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custo_voz_geral ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custos_voz_pais ENABLE ROW LEVEL SECURITY;

-- RLS policies: admin full access, authenticated read
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['custo_por_mega','taxas_link','valor_bloco_ip','equipamentos_valor','tabela_custos_pabx','custo_voz_geral','custos_voz_pais'])
  LOOP
    EXECUTE format('CREATE POLICY "Admins can manage %1$s" ON public.%1$s FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''admin''::app_role))', tbl);
    EXECUTE format('CREATE POLICY "Authenticated can read %1$s" ON public.%1$s FOR SELECT TO authenticated USING (true)', tbl);
  END LOOP;
END $$;

-- updated_at triggers
CREATE OR REPLACE TRIGGER update_custo_por_mega_updated_at BEFORE UPDATE ON public.custo_por_mega FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_taxas_link_updated_at BEFORE UPDATE ON public.taxas_link FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_valor_bloco_ip_updated_at BEFORE UPDATE ON public.valor_bloco_ip FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_equipamentos_valor_updated_at BEFORE UPDATE ON public.equipamentos_valor FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_tabela_custos_pabx_updated_at BEFORE UPDATE ON public.tabela_custos_pabx FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_custo_voz_geral_updated_at BEFORE UPDATE ON public.custo_voz_geral FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_custos_voz_pais_updated_at BEFORE UPDATE ON public.custos_voz_pais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
