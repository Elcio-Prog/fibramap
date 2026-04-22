-- BKO can view all pre_viabilidades (same as implantacao)
CREATE POLICY "BKO can view all pre_viabilidades"
ON public.pre_viabilidades
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'bko'::app_role));

-- BKO can update pre_viabilidades
CREATE POLICY "BKO can update pre_viabilidades"
ON public.pre_viabilidades
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'bko'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'bko'::app_role));

-- BKO can view history
CREATE POLICY "BKO can view all history"
ON public.pre_viabilidades_history
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'bko'::app_role));