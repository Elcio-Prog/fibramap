
-- Add prazo_ativacao to ws_feasibility_items
ALTER TABLE public.ws_feasibility_items
  ADD COLUMN prazo_ativacao text;

-- Create WS mapping profiles table
CREATE TABLE public.ws_mapping_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ws_mapping_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ws profiles"
  ON public.ws_mapping_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ws profiles"
  ON public.ws_mapping_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ws profiles"
  ON public.ws_mapping_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
