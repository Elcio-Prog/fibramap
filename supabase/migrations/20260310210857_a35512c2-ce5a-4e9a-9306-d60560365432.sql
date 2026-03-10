
ALTER TABLE public.ws_feasibility_items 
  ADD COLUMN IF NOT EXISTS produto text DEFAULT 'NT LINK DEDICADO FULL',
  ADD COLUMN IF NOT EXISTS tecnologia text DEFAULT 'GPON',
  ADD COLUMN IF NOT EXISTS tecnologia_meio_fisico text DEFAULT 'Fibra';
