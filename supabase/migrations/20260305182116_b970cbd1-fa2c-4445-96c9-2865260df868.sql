
-- Fix RLS on shared tables: keep SELECT for all authenticated, restrict writes to admins

-- providers
DROP POLICY IF EXISTS "Authenticated full access" ON public.providers;
CREATE POLICY "Anyone can read providers" ON public.providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can modify providers" ON public.providers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update providers" ON public.providers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete providers" ON public.providers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- lpu_items
DROP POLICY IF EXISTS "Authenticated full access" ON public.lpu_items;
CREATE POLICY "Anyone can read lpu_items" ON public.lpu_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can modify lpu_items" ON public.lpu_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update lpu_items" ON public.lpu_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete lpu_items" ON public.lpu_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- geo_elements
DROP POLICY IF EXISTS "Authenticated full access" ON public.geo_elements;
CREATE POLICY "Anyone can read geo_elements" ON public.geo_elements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can modify geo_elements" ON public.geo_elements FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update geo_elements" ON public.geo_elements FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete geo_elements" ON public.geo_elements FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- profiles: users can read all, but only update their own
DROP POLICY IF EXISTS "Authenticated full access" ON public.profiles;
CREATE POLICY "Anyone can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- compras_lm
DROP POLICY IF EXISTS "Authenticated full access" ON public.compras_lm;
CREATE POLICY "Anyone can read compras_lm" ON public.compras_lm FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert compras_lm" ON public.compras_lm FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update compras_lm" ON public.compras_lm FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete compras_lm" ON public.compras_lm FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- import_profiles
DROP POLICY IF EXISTS "Authenticated full access" ON public.import_profiles;
CREATE POLICY "Anyone can read import_profiles" ON public.import_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert import_profiles" ON public.import_profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update import_profiles" ON public.import_profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete import_profiles" ON public.import_profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- feasibility_queries: users can read/insert their own, admins can do all
DROP POLICY IF EXISTS "Authenticated full access" ON public.feasibility_queries;
CREATE POLICY "Anyone can read feasibility_queries" ON public.feasibility_queries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own queries" ON public.feasibility_queries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update feasibility_queries" ON public.feasibility_queries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete feasibility_queries" ON public.feasibility_queries FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
