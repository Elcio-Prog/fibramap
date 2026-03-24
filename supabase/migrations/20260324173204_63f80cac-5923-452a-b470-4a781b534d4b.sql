CREATE POLICY "Admins can delete pre_viabilidades"
ON public.pre_viabilidades
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));