
ALTER TABLE public.ws_feasibility_items
  ADD COLUMN cep_a text DEFAULT NULL,
  ADD COLUMN numero_a text DEFAULT NULL,
  ADD COLUMN cep_b text DEFAULT NULL,
  ADD COLUMN numero_b text DEFAULT NULL;
