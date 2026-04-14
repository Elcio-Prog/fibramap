CREATE POLICY "Users can delete own pre_viabilidades"
  ON public.pre_viabilidades FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);