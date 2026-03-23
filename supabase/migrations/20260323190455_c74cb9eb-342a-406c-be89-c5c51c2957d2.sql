INSERT INTO public.configuracoes (chave, valor)
VALUES ('setup_precificacao', '{"fator_ajuste": 100, "regra_projetista_ativa": false}'::jsonb)
ON CONFLICT (chave) DO NOTHING;