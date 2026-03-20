
CREATE TABLE public.vigencia_vs_roi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meses text NOT NULL,
  roi numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.vigencia_vs_roi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read vigencia_vs_roi"
  ON public.vigencia_vs_roi FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage vigencia_vs_roi"
  ON public.vigencia_vs_roi FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.vigencia_vs_roi (meses, roi) VALUES
('12', 4),
('16', 4),
('18', 5),
('24', 6),
('36', 8),
('48', 10),
('60', 12),
('1', 1),
('12 Equipamento', 4),
('16 Equipamento', 4),
('18 Equipamento', 5),
('24 Equipamento', 5),
('36 Equipamento', 8),
('48 Equipamento', 11),
('60 Equipamento', 15),
('1 Equipamento', 1);
