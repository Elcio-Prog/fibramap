
-- Drop old combined policy
DROP POLICY IF EXISTS "Vendedor and Implantacao can update own pre_viabilidades" ON public.pre_viabilidades;

-- Vendedor can still only update own
CREATE POLICY "Vendedor can update own pre_viabilidades"
ON public.pre_viabilidades
FOR UPDATE
USING (auth.uid() = user_id AND has_role(auth.uid(), 'vendedor'::app_role))
WITH CHECK (auth.uid() = user_id AND has_role(auth.uid(), 'vendedor'::app_role));

-- Implantacao (Validação) can view ALL pre_viabilidades
CREATE POLICY "Implantacao can view all pre_viabilidades"
ON public.pre_viabilidades
FOR SELECT
USING (has_role(auth.uid(), 'implantacao'::app_role));

-- Implantacao (Validação) can update ALL pre_viabilidades
CREATE POLICY "Implantacao can update all pre_viabilidades"
ON public.pre_viabilidades
FOR UPDATE
USING (has_role(auth.uid(), 'implantacao'::app_role))
WITH CHECK (has_role(auth.uid(), 'implantacao'::app_role));

-- Implantacao (Validação) can delete pre_viabilidades
CREATE POLICY "Implantacao can delete pre_viabilidades"
ON public.pre_viabilidades
FOR DELETE
USING (has_role(auth.uid(), 'implantacao'::app_role));
