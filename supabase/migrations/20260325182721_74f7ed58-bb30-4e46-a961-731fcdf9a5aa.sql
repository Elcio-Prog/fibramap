
CREATE TABLE public.integracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  url text NOT NULL DEFAULT '',
  token text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT 'webhook',
  ativo boolean NOT NULL DEFAULT true,
  descricao text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.integracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage integracoes" ON public.integracoes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read integracoes" ON public.integracoes
  FOR SELECT TO authenticated
  USING (true);
