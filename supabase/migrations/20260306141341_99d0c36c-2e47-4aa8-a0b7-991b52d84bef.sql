
-- Drop existing restrictive policies on pre_providers for write ops
DROP POLICY IF EXISTS "Admins can insert pre_providers" ON public.pre_providers;
DROP POLICY IF EXISTS "Admins can update pre_providers" ON public.pre_providers;
DROP POLICY IF EXISTS "Admins can delete pre_providers" ON public.pre_providers;

-- Allow both admin and ws_user to manage pre_providers
CREATE POLICY "Authenticated can insert pre_providers" ON public.pre_providers
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ws_user'::app_role));

CREATE POLICY "Authenticated can update pre_providers" ON public.pre_providers
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ws_user'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ws_user'::app_role));

CREATE POLICY "Authenticated can delete pre_providers" ON public.pre_providers
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ws_user'::app_role));

-- Drop existing restrictive policies on pre_provider_cities for write ops
DROP POLICY IF EXISTS "Admins can insert pre_provider_cities" ON public.pre_provider_cities;
DROP POLICY IF EXISTS "Admins can update pre_provider_cities" ON public.pre_provider_cities;
DROP POLICY IF EXISTS "Admins can delete pre_provider_cities" ON public.pre_provider_cities;

-- Allow both admin and ws_user to manage pre_provider_cities
CREATE POLICY "Authenticated can insert pre_provider_cities" ON public.pre_provider_cities
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ws_user'::app_role));

CREATE POLICY "Authenticated can update pre_provider_cities" ON public.pre_provider_cities
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ws_user'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ws_user'::app_role));

CREATE POLICY "Authenticated can delete pre_provider_cities" ON public.pre_provider_cities
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ws_user'::app_role));
