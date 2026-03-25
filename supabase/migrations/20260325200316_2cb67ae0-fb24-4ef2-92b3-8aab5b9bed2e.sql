
CREATE TABLE public.api_request_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  integration_name TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  request_params JSONB,
  response_status INTEGER,
  response_ok BOOLEAN,
  response_body JSONB,
  error_message TEXT,
  duration_ms INTEGER
);

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read api logs"
ON public.api_request_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert logs"
ON public.api_request_logs
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE INDEX idx_api_logs_created_at ON public.api_request_logs(created_at DESC);
CREATE INDEX idx_api_logs_integration ON public.api_request_logs(integration_name);
