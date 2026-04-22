CREATE POLICY "Users can update own ws profiles"
ON public.ws_mapping_profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);