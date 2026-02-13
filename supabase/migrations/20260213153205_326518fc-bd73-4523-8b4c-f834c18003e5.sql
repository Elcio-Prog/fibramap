
-- Drop all existing restrictive policies
DROP POLICY IF EXISTS "Authenticated full access" ON public.providers;
DROP POLICY IF EXISTS "Authenticated full access" ON public.geo_elements;
DROP POLICY IF EXISTS "Authenticated full access" ON public.lpu_items;
DROP POLICY IF EXISTS "Authenticated full access" ON public.feasibility_queries;
DROP POLICY IF EXISTS "Authenticated full access" ON public.profiles;

-- Recreate as PERMISSIVE policies for authenticated users
CREATE POLICY "Authenticated full access"
ON public.providers FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated full access"
ON public.geo_elements FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated full access"
ON public.lpu_items FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated full access"
ON public.feasibility_queries FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated full access"
ON public.profiles FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
