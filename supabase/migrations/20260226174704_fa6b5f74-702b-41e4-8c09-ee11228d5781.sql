
-- Table to store WS feasibility upload batches
CREATE TABLE public.ws_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  total_items integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.ws_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WS users can view own batches"
  ON public.ws_batches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "WS users can insert own batches"
  ON public.ws_batches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "WS users can update own batches"
  ON public.ws_batches FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Table to store individual feasibility items from uploaded spreadsheets
CREATE TABLE public.ws_feasibility_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.ws_batches(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  -- Key identification fields
  designacao text,
  cliente text,
  -- Link info
  tipo_link text,
  velocidade_original text,
  velocidade_mbps numeric,
  is_l2l boolean NOT NULL DEFAULT false,
  l2l_suffix text,
  l2l_pair_id text,
  -- Ponta A
  endereco_a text,
  cidade_a text,
  uf_a text,
  lat_a numeric,
  lng_a numeric,
  -- Ponta B (for L2L)
  endereco_b text,
  cidade_b text,
  uf_b text,
  lat_b numeric,
  lng_b numeric,
  -- Processing results
  processing_status text NOT NULL DEFAULT 'pending',
  result_stage text,
  result_provider text,
  result_value numeric,
  result_notes text,
  is_viable boolean,
  -- Raw data for reference
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ws_feasibility_items ENABLE ROW LEVEL SECURITY;

-- RLS: users can access items from their own batches
CREATE POLICY "Users can view own batch items"
  ON public.ws_feasibility_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ws_batches b
      WHERE b.id = batch_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own batch items"
  ON public.ws_feasibility_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ws_batches b
      WHERE b.id = batch_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own batch items"
  ON public.ws_feasibility_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ws_batches b
      WHERE b.id = batch_id AND b.user_id = auth.uid()
    )
  );

-- Index for batch lookups
CREATE INDEX idx_ws_items_batch ON public.ws_feasibility_items(batch_id);
CREATE INDEX idx_ws_items_status ON public.ws_feasibility_items(processing_status);
