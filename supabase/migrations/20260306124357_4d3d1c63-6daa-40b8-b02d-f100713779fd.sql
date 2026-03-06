
-- Add new fields to existing providers table
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS contato_comercial_email text,
  ADD COLUMN IF NOT EXISTS contato_noc_nome text,
  ADD COLUMN IF NOT EXISTS contato_noc_fone text,
  ADD COLUMN IF NOT EXISTS contato_noc_email text,
  ADD COLUMN IF NOT EXISTS cidade_sede text,
  ADD COLUMN IF NOT EXISTS estado_sede text,
  ADD COLUMN IF NOT EXISTS observacoes text;

-- Create pre_providers table
CREATE TABLE public.pre_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text,
  nome_fantasia text NOT NULL,
  cidade_sede text,
  estado_sede text,
  has_cross_ntt boolean NOT NULL DEFAULT false,
  oferece_mancha text DEFAULT 'NÃO',
  contato_comercial_nome text,
  contato_comercial_fone text,
  contato_comercial_email text,
  contato_noc_nome text,
  contato_noc_fone text,
  contato_noc_email text,
  observacoes text,
  status text NOT NULL DEFAULT 'pre_cadastro',
  promoted_provider_id uuid REFERENCES public.providers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create pre_provider_cities table
CREATE TABLE public.pre_provider_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_provider_id uuid NOT NULL REFERENCES public.pre_providers(id) ON DELETE CASCADE,
  cidade text NOT NULL,
  estado text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pre_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_provider_cities ENABLE ROW LEVEL SECURITY;

-- RLS policies for pre_providers
CREATE POLICY "Anyone can read pre_providers" ON public.pre_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert pre_providers" ON public.pre_providers FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update pre_providers" ON public.pre_providers FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete pre_providers" ON public.pre_providers FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for pre_provider_cities
CREATE POLICY "Anyone can read pre_provider_cities" ON public.pre_provider_cities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert pre_provider_cities" ON public.pre_provider_cities FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update pre_provider_cities" ON public.pre_provider_cities FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete pre_provider_cities" ON public.pre_provider_cities FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger for pre_providers
CREATE TRIGGER update_pre_providers_updated_at
  BEFORE UPDATE ON public.pre_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert pre-providers data (excluding DESKTOP which already exists)
INSERT INTO public.pre_providers (nome_fantasia, razao_social, cidade_sede, estado_sede, has_cross_ntt, oferece_mancha, contato_comercial_nome, contato_comercial_fone, contato_comercial_email, contato_noc_nome, contato_noc_fone, contato_noc_email, observacoes) VALUES
('MEGACOM', 'Megawlan Solucoes LTDA', 'JUIZ DE FORA', 'MG', false, 'SOLICITADO', 'Marcella', '35 9134-1911', NULL, NULL, NULL, NULL, NULL),
('In Networks', 'In Networks LTDA', 'Pouso Alegre', 'MG', false, 'SOLICITADO', 'Cristoffer', '35 9851-7929', 'cristoffer.pereira@innetworks.com.br', 'Marcelo', NULL, 'marcelo.borges@innetworks.com.br', 'Agregador'),
('NetServ', 'Net Serv LTDA', NULL, 'SP', false, 'RECEBIDO', 'Aline', '11 99332-3780', NULL, NULL, NULL, NULL, NULL),
('WCS', NULL, NULL, NULL, true, 'NÃO', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('CMA', NULL, NULL, NULL, true, 'NÃO', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('WIX', NULL, NULL, NULL, true, 'NÃO', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('ALGAR', NULL, NULL, NULL, true, 'NÃO', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('ZAAZ', NULL, NULL, NULL, true, 'NÃO', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('X TURBO', NULL, NULL, NULL, true, 'NÃO', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('TELIUM', NULL, NULL, NULL, true, 'NÃO', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('NEOLINK', NULL, NULL, NULL, true, 'NÃO', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('NETAKI', NULL, NULL, NULL, true, 'NÃO', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('ALARES', 'Alares Internet S.A.', NULL, NULL, true, 'NÃO', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('NOVVACORE', NULL, NULL, NULL, true, 'NÃO', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('MGA NET', 'MGA NET PROVEDOR DE INTERNET LTDA', NULL, NULL, false, 'RECEBIDO', 'LAURA', '54 9655-7301', NULL, NULL, NULL, NULL, NULL),
('MICROSET', NULL, NULL, NULL, true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('Entrenanet', 'Chapeco Tecnologia em Telecomunicacoes LTDA', 'CHAPECÓ', 'SC', false, 'NÃO', 'JÉSSICA', '(49) 98502-5869', NULL, NULL, NULL, NULL, NULL),
('G2G', 'G2G Internet e Serviços de Telecom Ltda', NULL, 'SP', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('Cabonnet', NULL, NULL, 'SP', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- Insert cities for MEGACOM
INSERT INTO public.pre_provider_cities (pre_provider_id, cidade, estado)
SELECT id, 'JUIZ DE FORA', 'MG' FROM public.pre_providers WHERE nome_fantasia = 'MEGACOM';

-- Insert cities for In Networks
INSERT INTO public.pre_provider_cities (pre_provider_id, cidade, estado)
SELECT id, 'Pouso Alegre', 'MG' FROM public.pre_providers WHERE nome_fantasia = 'In Networks';

-- Insert cities for G2G
INSERT INTO public.pre_provider_cities (pre_provider_id, cidade, estado)
SELECT id, c.cidade, c.estado FROM public.pre_providers pp,
(VALUES ('Valinhos','SP'),('Campinas','SP'),('Hortolândia','SP'),('Vargem Grande Paulista','SP'),('Cotia','SP'),('Ibiuna','SP'),('Piedade','SP'),('Sorocaba','SP'),('Alumínio','SP'),('Mairinque','SP'),('Salto','SP'),('Itu','SP'),('Araçariguama','SP'),('Porto Feliz','SP'),('Pirapora do Bom Jesus','SP'),('São Roque','SP'),('Cabreúva','SP'),('Itupeva','SP'),('Jundiai','SP'),('Vinhedo','SP'),('Louveira','SP'),('Sumaré','SP')) AS c(cidade, estado)
WHERE pp.nome_fantasia = 'G2G';

-- Insert cities for NetServ
INSERT INTO public.pre_provider_cities (pre_provider_id, cidade, estado)
SELECT id, c.cidade, c.estado FROM public.pre_providers pp,
(VALUES ('Itu','SP'),('Salto','SP'),('Cabreúva','SP'),('Porto Feliz','SP'),('Indaiatuba','SP'),('Itupeva','SP'),('Sorocaba','SP')) AS c(cidade, estado)
WHERE pp.nome_fantasia = 'NetServ';

-- Insert cities for ALARES
INSERT INTO public.pre_provider_cities (pre_provider_id, cidade, estado)
SELECT id, c.cidade, c.estado FROM public.pre_providers pp,
(VALUES
('Águas da Prata','SP'),('Alfenas','MG'),('Alterosa','MG'),('Álvares Machado','SP'),('Aquiraz','CE'),('Araras','SP'),('Areado','MG'),('Assis','SP'),('Atibaia','SP'),('Bandeira do Sul','MG'),('Bandeirantes','PR'),('Barra do Turvo','SP'),('Barueri','SP'),('Bastos','SP'),('Bernardino de Campos','SP'),('Bom Jesus da Penha','MG'),('Botelhos','MG'),('Brejinho','RN'),('Cabo Verde','MG'),('Cabrália Paulista','SP'),('Cabreúva','SP'),('Cachoeira de Minas','MG'),('Caconde','SP'),('Cajati','SP'),('Caldas','MG'),('Cambará','PR'),('Cambuquira','MG'),('Campanha','MG'),('Campestre','MG'),('Campinas','SP'),('Campos Novos Paulista','SP'),('Cândido Mota','SP'),('Canguaretama','RN'),('Canitar','SP'),('Capivari','SP'),('Carlópolis','PR'),('Carmo de Minas','MG'),('Casa Branca','SP'),('Caucaia','CE'),('Chavantes','SP'),('Conceição do Rio Verde','MG'),('Cornélio Procópio','PR'),('Cotia','SP'),('Divinolândia','SP'),('Divisa Nova','MG'),('Eldorado','SP'),('Elias Fausto','SP'),('Elói Mendes','MG'),('Embu das Artes','SP'),('Espírito Santo do Pinhal','SP'),('Estiva Gerbi','SP'),('Eunápolis','BA'),('Eusébio','CE'),('Fama','MG'),('Fartura','SP'),('Fortaleza','CE'),('Goianinha','RN'),('Guaranésia','MG'),('Guaxupé','MG'),('Iacri','SP'),('Ibirarema','SP'),('Ibituruna de Minas','MG'),('Ibiúna','SP'),('Iguape','SP'),('Ilha Comprida','SP'),('Indaiatuba','SP'),('Indiana','SP'),('Inúbia Paulista','SP'),('Ipaussu','SP'),('Iporanga','SP'),('Ipuiúna','MG'),('Itaberá','SP'),('Itajubá','MG'),('Itamonte','MG'),('Itanhandu','MG'),('Itapecerica da Serra','SP'),('Itapetininga','SP'),('Itapeva','SP'),('Itapevi','SP'),('Itararé','SP'),('Itatiba','SP'),('Itobi','SP'),('Itupeva','SP'),('Jacarezinho','PR'),('Jacupiranga','SP'),('Jandira','SP'),('João Pessoa','PB'),('Jundiaí','SP'),('Juquiá','SP'),('Juquitiba','SP'),('Lambari','MG'),('Lençóis Paulista','SP'),('Limeira','SP'),('Louveira','SP'),('Lucélia','SP'),('Machado','MG'),('Maracaí','SP'),('Maracanaú','CE'),('Marília','SP'),('Miracatu','SP'),('Mococa','SP'),('Mogi Guaçu','SP'),('Mogi Mirim','SP'),('Monte Alegre do Sul','SP'),('Monte Belo','MG'),('Monte Mor','SP'),('Monte Santo de Minas','MG'),('Muzambinho','MG'),('Natal','RN'),('Nísia Floresta','RN'),('Nova Alexandria','SP'),('Nova Cruz','RN'),('Nova Resende','MG'),('Ourinhos','SP'),('Pacatuba','CE'),('Palmital','SP'),('Paraguaçu','MG'),('Paraguaçu Paulista','SP'),('Parapuã','SP'),('Pariquera-Açu','SP'),('Parnamirim','RN'),('Passa Quatro','MG'),('Pedro de Toledo','SP'),('Piedade','SP'),('Piraju','SP'),('Pirapozinho','SP'),('Piratininga','SP'),('Platina','SP'),('Poços de Caldas','MG'),('Porto Seguro','BA'),('Pouso Alegre','MG'),('Presidente Prudente','SP'),('Regente Feijó','SP'),('Registro','SP'),('Ribeirão Claro','PR'),('Ribeirão do Sul','SP'),('Rinópolis','SP'),('Rio Claro','SP'),('S. Antônio da Platina','PR'),('S. Gonçalo do Amarante','RN'),('S. Gonçalo do Sapucaí','MG'),('S. Sebastião Bela Vista','MG'),('S. Sebastião da Grama','SP'),('S. Sebastião Rio Verde','MG'),('Salto','SP'),('Salto Grande','SP'),('Santa Amélia','PR'),('Santa Cruz','RN'),('Santa Cruz do Rio Pardo','SP'),('Santa Mariana','PR'),('Santa Rita de Caldas','MG'),('Santa Rita do Sapucaí','MG'),('São Bento Abade','MG'),('São João da Boa Vista','SP'),('São José de Mipibu','RN'),('São José do Rio Pardo','SP'),('São Lourenço','MG'),('São Lourenço da Serra','SP'),('São Paulo','SP'),('São Pedro da União','MG'),('São Pedro do Turvo','SP'),('São Thomé das Letras','MG'),('Sarutaiá','SP'),('Sete Barras','SP'),('Siqueira Campos','PR'),('Sorocaba','SP'),('Taboão da Serra','SP'),('Taguaí','SP'),('Tambaú','SP'),('Tapiratiba','SP'),('Taquarituba','SP'),('Tatuí','SP'),('Tibau do Sul','RN'),('Timburi','SP'),('Três Corações','MG'),('Três Pontas','MG'),('Tupã','SP'),('Vargem Grande Paulista','SP'),('Varginha','MG'),('Wenceslau Braz','PR')
) AS c(cidade, estado)
WHERE pp.nome_fantasia = 'ALARES';

-- Insert cities for MGA NET
INSERT INTO public.pre_provider_cities (pre_provider_id, cidade, estado)
SELECT id, c.cidade, c.estado FROM public.pre_providers pp,
(VALUES ('Veranopolis','RS'),('Vila Flores','RS'),('Nova Prata','RS'),('Nova Bassano','RS'),('Protasio Alves','RS'),('Andre da Rocha','RS'),('Casca','RS'),('São Domingos Do Sul','RS'),('Vanini','RS'),('Davi Canabarro','RS'),('Gentil','RS'),('Santo Antonio Do Palma','RS')) AS c(cidade, estado)
WHERE pp.nome_fantasia = 'MGA NET';

-- Insert cities for Cabonnet
INSERT INTO public.pre_provider_cities (pre_provider_id, cidade, estado)
SELECT id, c.cidade, c.estado FROM public.pre_providers pp,
(VALUES ('Adamantina','SP'),('Alvares Machado','SP'),('ArcoIris','SP'),('Assis','SP'),('Bastos','SP'),('Bora','SP'),('Caçapava','SP'),('Candido Mota','SP'),('Florida Paulista','SP'),('Florinea','SP'),('Getulina','SP'),('Guaiçara','SP'),('Herculandia','SP'),('Iacri','SP'),('Inubia Paulista','SP'),('Lins','SP'),('Lucelia','SP'),('Maracai','SP'),('Mariapolis','SP'),('Martinopolis','SP'),('Osvaldo Cruz','SP'),('Ourinhos','SP'),('Pacaembu','SP'),('Paraguacu Paulista','SP'),('Parapua','SP'),('Penapolis','SP'),('Pindamonhangaba','SP'),('Presidente Prudente','SP'),('Promissao','SP'),('Quata','SP'),('Queiroz','SP'),('Rancharia','SP'),('Ribeirao Claro','SP'),('Santa Cruz do Rio Pardo','SP'),('São José dos Campos','SP'),('São Pedro do Turvo','SP'),('Taubate','SP'),('Tremembe','SP'),('Tupã','SP')) AS c(cidade, estado)
WHERE pp.nome_fantasia = 'Cabonnet';

-- Insert cities for Entrenanet
INSERT INTO public.pre_provider_cities (pre_provider_id, cidade, estado)
SELECT id, c.cidade, c.estado FROM public.pre_providers pp,
(VALUES ('Chapecó','SC'),('Guatambu','SC'),('Caxambu','SC'),('Águas de Chapecó','SC'),('Planalto alegre','SC'),('São Carlos','SC'),('Cordilheira alta','SC'),('Coronel Freitas','SC'),('Nova Erechim','SC'),('Águas Frias','SC'),('Pinhalzinho','SC'),('Nova Itaberaba','SC')) AS c(cidade, estado)
WHERE pp.nome_fantasia = 'Entrenanet';
