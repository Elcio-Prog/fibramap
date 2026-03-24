
CREATE TABLE public.pre_viabilidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  criado_por text,
  status text DEFAULT 'Ativa',
  tipo_solicitacao text,
  produto_nt text,
  vigencia integer,
  valor_minimo numeric,
  viabilidade text,
  ticket_mensal numeric,
  status_aprovacao text,
  aprovado_por text,
  nome_cliente text,
  previsao_roi numeric,
  roi_global numeric,
  status_viabilidade text,
  projetista text,
  motivo_solicitacao text,
  observacoes text,
  id_guardachuva text,
  codigo_smark text,
  inviabilidade_tecnica text,
  comentarios_aprovador text,
  observacao_validacao text,
  origem text DEFAULT 'fibramap',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pre_viabilidades ENABLE ROW LEVEL SECURITY;

-- Users can view their own records
CREATE POLICY "Users can view own pre_viabilidades"
ON public.pre_viabilidades FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all records
CREATE POLICY "Admins can view all pre_viabilidades"
ON public.pre_viabilidades FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can insert their own records
CREATE POLICY "Users can insert own pre_viabilidades"
ON public.pre_viabilidades FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can update any record
CREATE POLICY "Admins can update pre_viabilidades"
ON public.pre_viabilidades FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
