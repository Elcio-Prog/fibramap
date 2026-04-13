-- Allow vendedor and implantacao to update their own pre_viabilidades
CREATE POLICY "Vendedor and Implantacao can update own pre_viabilidades"
ON public.pre_viabilidades
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND (public.has_role(auth.uid(), 'vendedor') OR public.has_role(auth.uid(), 'implantacao')))
WITH CHECK (auth.uid() = user_id AND (public.has_role(auth.uid(), 'vendedor') OR public.has_role(auth.uid(), 'implantacao')));