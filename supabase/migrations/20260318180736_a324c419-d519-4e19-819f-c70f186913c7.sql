CREATE POLICY "Admins can view all batch items"
ON public.ws_feasibility_items
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));