
-- Create a smarter trigger function for pre_viabilidades that preserves updated_at
-- when only roi_global is being changed (bulk ROI recalculation)
CREATE OR REPLACE FUNCTION public.update_pre_viabilidades_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- If the only meaningful change is roi_global (and updated_at itself), preserve original timestamp
  IF OLD.roi_global IS DISTINCT FROM NEW.roi_global
     AND NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at
     AND ROW(OLD.status, OLD.tipo_solicitacao, OLD.produto_nt, OLD.vigencia, OLD.valor_minimo, OLD.viabilidade,
             OLD.ticket_mensal, OLD.status_aprovacao, OLD.aprovado_por, OLD.nome_cliente, OLD.previsao_roi,
             OLD.status_viabilidade, OLD.projetista, OLD.motivo_solicitacao, OLD.observacoes, OLD.id_guardachuva,
             OLD.codigo_smark, OLD.inviabilidade_tecnica, OLD.comentarios_aprovador, OLD.observacao_validacao,
             OLD.origem, OLD.dados_precificacao, OLD.modificado_por, OLD.cnpj_cliente, OLD.coordenadas,
             OLD.endereco, OLD.protocolo, OLD.data_reavaliacao, OLD.criado_por)
         IS NOT DISTINCT FROM
         ROW(NEW.status, NEW.tipo_solicitacao, NEW.produto_nt, NEW.vigencia, NEW.valor_minimo, NEW.viabilidade,
             NEW.ticket_mensal, NEW.status_aprovacao, NEW.aprovado_por, NEW.nome_cliente, NEW.previsao_roi,
             NEW.status_viabilidade, NEW.projetista, NEW.motivo_solicitacao, NEW.observacoes, NEW.id_guardachuva,
             NEW.codigo_smark, NEW.inviabilidade_tecnica, NEW.comentarios_aprovador, NEW.observacao_validacao,
             NEW.origem, NEW.dados_precificacao, NEW.modificado_por, NEW.cnpj_cliente, NEW.coordenadas,
             NEW.endereco, NEW.protocolo, NEW.data_reavaliacao, NEW.criado_por)
  THEN
    -- Only roi_global changed, preserve original updated_at
    NEW.updated_at = OLD.updated_at;
  ELSE
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- Drop old trigger and create new one with the smarter function
DROP TRIGGER IF EXISTS update_pre_viabilidades_updated_at ON public.pre_viabilidades;
CREATE TRIGGER update_pre_viabilidades_updated_at
  BEFORE UPDATE ON public.pre_viabilidades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pre_viabilidades_updated_at();
