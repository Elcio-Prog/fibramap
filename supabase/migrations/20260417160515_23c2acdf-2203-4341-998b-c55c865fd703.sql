
-- Add attachments column to pre_viabilidades
ALTER TABLE public.pre_viabilidades
ADD COLUMN IF NOT EXISTS anexos jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Create private storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('pre-viabilidade-anexos', 'pre-viabilidade-anexos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies: authenticated users can manage files inside the bucket
CREATE POLICY "Authenticated users can read pre-viabilidade attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'pre-viabilidade-anexos');

CREATE POLICY "Authenticated users can upload pre-viabilidade attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pre-viabilidade-anexos');

CREATE POLICY "Authenticated users can update pre-viabilidade attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'pre-viabilidade-anexos');

CREATE POLICY "Authenticated users can delete pre-viabilidade attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'pre-viabilidade-anexos');
