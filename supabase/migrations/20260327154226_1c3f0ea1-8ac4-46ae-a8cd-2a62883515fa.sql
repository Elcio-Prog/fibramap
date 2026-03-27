
CREATE TABLE public.geogrid_viabilidade_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geogrid_id text NOT NULL,
  sigla text NOT NULL DEFAULT '',
  portas_livres integer NOT NULL DEFAULT 0,
  latitude numeric NULL,
  longitude numeric NULL,
  status_viabilidade text NOT NULL DEFAULT '',
  item text NOT NULL DEFAULT '',
  portas integer NOT NULL DEFAULT 0,
  portas_ocupadas integer NOT NULL DEFAULT 0,
  fibras integer NOT NULL DEFAULT 0,
  fibras_livres integer NOT NULL DEFAULT 0,
  fibras_ocupadas integer NOT NULL DEFAULT 0,
  recipiente_id text NOT NULL DEFAULT '',
  recipiente_item text NOT NULL DEFAULT '',
  recipiente_sigla text NOT NULL DEFAULT '',
  pasta_nome text NOT NULL DEFAULT '',
  enriched boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(geogrid_id)
);

ALTER TABLE public.geogrid_viabilidade_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage geogrid_viabilidade_cache"
  ON public.geogrid_viabilidade_cache
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read geogrid_viabilidade_cache"
  ON public.geogrid_viabilidade_cache
  FOR SELECT
  TO authenticated
  USING (true);
