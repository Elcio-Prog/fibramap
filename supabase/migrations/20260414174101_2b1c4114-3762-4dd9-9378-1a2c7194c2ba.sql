
CREATE TABLE public.pre_viabilidades_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pre_viabilidade_id UUID NOT NULL REFERENCES public.pre_viabilidades(id) ON DELETE CASCADE,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  changed_by TEXT,
  snapshot JSONB NOT NULL,
  changed_fields TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_pv_history_pre_viabilidade_id ON public.pre_viabilidades_history(pre_viabilidade_id);
CREATE INDEX idx_pv_history_changed_at ON public.pre_viabilidades_history(changed_at DESC);

ALTER TABLE public.pre_viabilidades_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all history"
ON public.pre_viabilidades_history
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Implantacao can view all history"
ON public.pre_viabilidades_history
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'implantacao'::app_role));

CREATE POLICY "Users can view own history"
ON public.pre_viabilidades_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pre_viabilidades pv
    WHERE pv.id = pre_viabilidades_history.pre_viabilidade_id
    AND pv.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert history"
ON public.pre_viabilidades_history
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Service role can insert history"
ON public.pre_viabilidades_history
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.track_pre_viabilidade_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  changed TEXT[] := '{}';
  snap JSONB;
BEGIN
  -- Compare relevant fields and track which ones changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN changed := array_append(changed, 'status'); END IF;
  IF OLD.tipo_solicitacao IS DISTINCT FROM NEW.tipo_solicitacao THEN changed := array_append(changed, 'tipo_solicitacao'); END IF;
  IF OLD.produto_nt IS DISTINCT FROM NEW.produto_nt THEN changed := array_append(changed, 'produto_nt'); END IF;
  IF OLD.vigencia IS DISTINCT FROM NEW.vigencia THEN changed := array_append(changed, 'vigencia'); END IF;
  IF OLD.valor_minimo IS DISTINCT FROM NEW.valor_minimo THEN changed := array_append(changed, 'valor_minimo'); END IF;
  IF OLD.viabilidade IS DISTINCT FROM NEW.viabilidade THEN changed := array_append(changed, 'viabilidade'); END IF;
  IF OLD.ticket_mensal IS DISTINCT FROM NEW.ticket_mensal THEN changed := array_append(changed, 'ticket_mensal'); END IF;
  IF OLD.status_aprovacao IS DISTINCT FROM NEW.status_aprovacao THEN changed := array_append(changed, 'status_aprovacao'); END IF;
  IF OLD.aprovado_por IS DISTINCT FROM NEW.aprovado_por THEN changed := array_append(changed, 'aprovado_por'); END IF;
  IF OLD.nome_cliente IS DISTINCT FROM NEW.nome_cliente THEN changed := array_append(changed, 'nome_cliente'); END IF;
  IF OLD.previsao_roi IS DISTINCT FROM NEW.previsao_roi THEN changed := array_append(changed, 'previsao_roi'); END IF;
  IF OLD.roi_global IS DISTINCT FROM NEW.roi_global THEN changed := array_append(changed, 'roi_global'); END IF;
  IF OLD.projetista IS DISTINCT FROM NEW.projetista THEN changed := array_append(changed, 'projetista'); END IF;
  IF OLD.motivo_solicitacao IS DISTINCT FROM NEW.motivo_solicitacao THEN changed := array_append(changed, 'motivo_solicitacao'); END IF;
  IF OLD.observacoes IS DISTINCT FROM NEW.observacoes THEN changed := array_append(changed, 'observacoes'); END IF;
  IF OLD.id_guardachuva IS DISTINCT FROM NEW.id_guardachuva THEN changed := array_append(changed, 'id_guardachuva'); END IF;
  IF OLD.codigo_smark IS DISTINCT FROM NEW.codigo_smark THEN changed := array_append(changed, 'codigo_smark'); END IF;
  IF OLD.inviabilidade_tecnica IS DISTINCT FROM NEW.inviabilidade_tecnica THEN changed := array_append(changed, 'inviabilidade_tecnica'); END IF;
  IF OLD.comentarios_aprovador IS DISTINCT FROM NEW.comentarios_aprovador THEN changed := array_append(changed, 'comentarios_aprovador'); END IF;
  IF OLD.observacao_validacao IS DISTINCT FROM NEW.observacao_validacao THEN changed := array_append(changed, 'observacao_validacao'); END IF;
  IF OLD.cnpj_cliente IS DISTINCT FROM NEW.cnpj_cliente THEN changed := array_append(changed, 'cnpj_cliente'); END IF;
  IF OLD.endereco IS DISTINCT FROM NEW.endereco THEN changed := array_append(changed, 'endereco'); END IF;
  IF OLD.coordenadas IS DISTINCT FROM NEW.coordenadas THEN changed := array_append(changed, 'coordenadas'); END IF;
  IF OLD.protocolo IS DISTINCT FROM NEW.protocolo THEN changed := array_append(changed, 'protocolo'); END IF;
  IF OLD.data_reavaliacao IS DISTINCT FROM NEW.data_reavaliacao THEN changed := array_append(changed, 'data_reavaliacao'); END IF;
  IF OLD.dados_precificacao IS DISTINCT FROM NEW.dados_precificacao THEN changed := array_append(changed, 'dados_precificacao'); END IF;

  -- Only track if meaningful fields changed (not just updated_at/roi_global alone)
  IF array_length(changed, 1) IS NULL OR (array_length(changed, 1) = 1 AND changed[1] = 'roi_global') THEN
    RETURN NEW;
  END IF;

  -- Build snapshot of OLD values
  snap := jsonb_build_object(
    'status', OLD.status, 'tipo_solicitacao', OLD.tipo_solicitacao, 'produto_nt', OLD.produto_nt,
    'vigencia', OLD.vigencia, 'valor_minimo', OLD.valor_minimo, 'viabilidade', OLD.viabilidade,
    'ticket_mensal', OLD.ticket_mensal, 'status_aprovacao', OLD.status_aprovacao,
    'aprovado_por', OLD.aprovado_por, 'nome_cliente', OLD.nome_cliente,
    'previsao_roi', OLD.previsao_roi, 'roi_global', OLD.roi_global,
    'projetista', OLD.projetista, 'motivo_solicitacao', OLD.motivo_solicitacao,
    'observacoes', OLD.observacoes, 'id_guardachuva', OLD.id_guardachuva,
    'codigo_smark', OLD.codigo_smark, 'inviabilidade_tecnica', OLD.inviabilidade_tecnica,
    'comentarios_aprovador', OLD.comentarios_aprovador, 'observacao_validacao', OLD.observacao_validacao,
    'cnpj_cliente', OLD.cnpj_cliente, 'endereco', OLD.endereco, 'coordenadas', OLD.coordenadas,
    'protocolo', OLD.protocolo, 'data_reavaliacao', OLD.data_reavaliacao,
    'dados_precificacao', OLD.dados_precificacao
  );

  INSERT INTO public.pre_viabilidades_history (pre_viabilidade_id, changed_at, changed_by, snapshot, changed_fields)
  VALUES (NEW.id, now(), NEW.modificado_por, snap, changed);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pre_viabilidade_history
BEFORE UPDATE ON public.pre_viabilidades
FOR EACH ROW
EXECUTE FUNCTION public.track_pre_viabilidade_changes();
