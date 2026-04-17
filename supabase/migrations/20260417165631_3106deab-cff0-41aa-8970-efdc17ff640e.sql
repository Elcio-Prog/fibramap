-- LM users full management on compras_lm
CREATE POLICY "LM can insert compras_lm"
ON public.compras_lm FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'lm'::app_role));

CREATE POLICY "LM can update compras_lm"
ON public.compras_lm FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'lm'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'lm'::app_role));

CREATE POLICY "LM can delete compras_lm"
ON public.compras_lm FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'lm'::app_role));

-- LM users can manage import_profiles for LM imports
CREATE POLICY "LM can insert import_profiles"
ON public.import_profiles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'lm'::app_role));

CREATE POLICY "LM can update import_profiles"
ON public.import_profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'lm'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'lm'::app_role));

CREATE POLICY "LM can delete import_profiles"
ON public.import_profiles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'lm'::app_role));
