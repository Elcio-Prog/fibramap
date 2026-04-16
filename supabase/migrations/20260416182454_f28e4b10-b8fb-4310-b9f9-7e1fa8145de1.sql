-- Token table for email approval links
CREATE TABLE public.aprovacao_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  pre_viabilidade_id UUID NOT NULL REFERENCES public.pre_viabilidades(id) ON DELETE CASCADE,
  responsavel_email TEXT NOT NULL,
  nivel INTEGER NOT NULL,
  nivel_label TEXT NOT NULL,
  motivo TEXT NOT NULL,
  solicitante_email TEXT,
  solicitante_nome TEXT,
  acao_realizada TEXT,
  acao_em TIMESTAMP WITH TIME ZONE,
  comentario TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_aprovacao_tokens_token ON public.aprovacao_tokens(token);
CREATE INDEX idx_aprovacao_tokens_pre_viab ON public.aprovacao_tokens(pre_viabilidade_id);

ALTER TABLE public.aprovacao_tokens ENABLE ROW LEVEL SECURITY;

-- Authenticated users (the requester) can read tokens
CREATE POLICY "Authenticated can read aprovacao_tokens"
  ON public.aprovacao_tokens FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert / update / delete via direct API; edge functions use service role
CREATE POLICY "Admins can insert aprovacao_tokens"
  ON public.aprovacao_tokens FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update aprovacao_tokens"
  ON public.aprovacao_tokens FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete aprovacao_tokens"
  ON public.aprovacao_tokens FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));