
-- 1. Create configuracoes table for webhook and field mapping settings
CREATE TABLE public.configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage configuracoes" ON public.configuracoes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read configuracoes" ON public.configuracoes
  FOR SELECT TO authenticated
  USING (true);

-- 2. Create logs_envio_sharepoint table
CREATE TABLE public.logs_envio_sharepoint (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  usuario_email text NOT NULL,
  quantidade_itens integer NOT NULL DEFAULT 0,
  id_lote uuid NOT NULL,
  data_envio timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sucesso',
  response_code integer,
  mensagem_erro text
);

ALTER TABLE public.logs_envio_sharepoint ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own logs" ON public.logs_envio_sharepoint
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own logs" ON public.logs_envio_sharepoint
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 3. Add sent status columns to ws_feasibility_items
ALTER TABLE public.ws_feasibility_items
  ADD COLUMN IF NOT EXISTS enviado_para_sharepoint boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_envio timestamptz;

-- 4. Seed default configurations
INSERT INTO public.configuracoes (chave, valor) VALUES
  ('webhook', '{"url": "", "token": ""}'::jsonb),
  ('field_mapping', '[
    {"colunaApp":"Designação","campoJson":"protocolo","tipo":"string"},
    {"colunaApp":"Cliente","campoJson":"nomeCliente","tipo":"string"},
    {"colunaApp":"CNPJ","campoJson":"cnpj","tipo":"string"},
    {"colunaApp":"Endereço","campoJson":"endereco","tipo":"string"},
    {"colunaApp":"Cidade","campoJson":"cidade","tipo":"string"},
    {"colunaApp":"Geo","campoJson":"coordenadas","tipo":"string"},
    {"colunaApp":"Viável","campoJson":"status","tipo":"string"},
    {"colunaApp":"Melhor Etapa","campoJson":"melhorEtapa","tipo":"string"},
    {"colunaApp":"Provedor","campoJson":"provedor","tipo":"string"},
    {"colunaApp":"Vel.","campoJson":"velocidade","tipo":"string"},
    {"colunaApp":"Distância","campoJson":"distancia","tipo":"number"},
    {"colunaApp":"Vigência","campoJson":"vigencia","tipo":"string"},
    {"colunaApp":"Taxa Inst.","campoJson":"taxaInstalacao","tipo":"number"},
    {"colunaApp":"Vlr Venda","campoJson":"valorVendido","tipo":"number"},
    {"colunaApp":"Bloco IP","campoJson":"blocoIp","tipo":"string"},
    {"colunaApp":"Tipo Sol.","campoJson":"tipoSolicitacao","tipo":"string"},
    {"colunaApp":"Cód. Smark","campoJson":"codigoSmark","tipo":"string"},
    {"colunaApp":"Obs. Usuário","campoJson":"observacoes","tipo":"string"},
    {"colunaApp":"Obs. Sistema","campoJson":"observacoesSistema","tipo":"string"}
  ]'::jsonb)
ON CONFLICT (chave) DO NOTHING;
