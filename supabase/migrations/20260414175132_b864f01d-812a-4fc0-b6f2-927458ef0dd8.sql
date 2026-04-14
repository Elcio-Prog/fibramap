
-- Add new_values column
ALTER TABLE public.pre_viabilidades_history
ADD COLUMN new_values jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Replace trigger function to also capture new values
CREATE OR REPLACE FUNCTION public.track_pre_viabilidade_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  snap jsonb := '{}'::jsonb;
  new_snap jsonb := '{}'::jsonb;
  changed text[] := '{}';
  cols text[] := ARRAY[
    'status','tipo_solicitacao','produto_nt','vigencia','valor_minimo',
    'viabilidade','ticket_mensal','status_aprovacao','aprovado_por',
    'nome_cliente','previsao_roi','roi_global','projetista',
    'motivo_solicitacao','observacoes','id_guardachuva','codigo_smark',
    'inviabilidade_tecnica','comentarios_aprovador','observacao_validacao',
    'cnpj_cliente','endereco','coordenadas','protocolo','data_reavaliacao',
    'dados_precificacao','status_viabilidade'
  ];
  c text;
  old_val text;
  new_val text;
BEGIN
  FOREACH c IN ARRAY cols LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', c, c)
      INTO old_val, new_val USING OLD, NEW;
    IF old_val IS DISTINCT FROM new_val THEN
      changed := array_append(changed, c);
      snap := snap || jsonb_build_object(c, to_jsonb(old_val));
      new_snap := new_snap || jsonb_build_object(c, to_jsonb(new_val));
    END IF;
  END LOOP;

  IF array_length(changed, 1) > 0 THEN
    INSERT INTO public.pre_viabilidades_history
      (pre_viabilidade_id, changed_at, changed_by, snapshot, new_values, changed_fields)
    VALUES
      (NEW.id, now(), NEW.modificado_por, snap, new_snap, changed);
  END IF;

  RETURN NEW;
END;
$$;
