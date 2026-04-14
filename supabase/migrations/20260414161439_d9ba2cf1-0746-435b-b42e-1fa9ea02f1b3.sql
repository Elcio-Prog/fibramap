
CREATE TABLE public.ws_single_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  address TEXT,
  lat NUMERIC,
  lng NUMERIC,
  is_viable BOOLEAN,
  result_provider TEXT,
  result_value NUMERIC,
  result_distance_m NUMERIC,
  result_stage TEXT,
  result_notes TEXT,
  search_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ws_single_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own single searches"
  ON public.ws_single_searches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own single searches"
  ON public.ws_single_searches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all single searches"
  ON public.ws_single_searches FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
