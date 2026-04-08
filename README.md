# 🗺️ FibraMap

> Plataforma web interna para análise de viabilidade de fibra óptica, gestão de provedores, base last mile e processamento em lote — voltada a equipes de vendas e operações WS.

---

## 📋 Sobre o Projeto

O **FibraMap** é uma aplicação React/TypeScript desenvolvida na plataforma [Lovable](https://lovable.dev), com Supabase como backend. Ela centraliza o processo de consulta de viabilidade técnica de instalação de fibra óptica, permitindo que times admin e WS (Wireless/Field) consultem endereços, importem planilhas, visualizem coberturas em mapa e enviem resultados via webhook para o Microsoft SharePoint / Lists.

---

## ✨ Funcionalidades

### 🔐 Autenticação e Controle de Acesso
- Login via Supabase Auth
- Dois perfis de acesso: **Admin** e **WS User**
- Redirecionamento automático por role na landing page
- RLS (Row Level Security) aplicado em todas as tabelas

### 🗺️ Mapa Interativo (Admin)
- Visualização de elementos geográficos via **Leaflet**
- Importação de arquivos **KML**, **KMZ** e **GeoJSON** por provedor
- Camadas por provedor com toggle de visibilidade
- Busca de endereço com geocodificação integrada
- Exclusão de elementos por provedor com confirmação

### ⚡ Motor de Viabilidade WS
- Geocodificação por endereço, CEP ou coordenadas manuais
- Cálculo de distância por **rota real** (via Overpass/OSRM)
- Verificação de cruzamento com **CPFL**, rodovias e ferrovias
- Checagem de cobertura por polígono geográfico
- Extração de cabos **NTT** próximos
- Identificação de ponto de conexão mais próximo (por rede própria ou terceiros)
- Suporte a links **L2L** (Location-to-Location) com pares de endereços A e B

### 📤 Upload e Processamento em Lote (WS)
- Wizard de importação de planilhas **.xlsx** com mapeamento de colunas
- Perfis de importação salvos por usuário
- Processamento assíncrono com progresso salvo item a item no banco
- Visualização de lotes (`/ws/batch/:batchId`) com status por item
- Opção de busca pontual sem upload (`/ws/single`)

### 📋 Base Last Mile (LM)
- Importação de base de provedores via planilha com geocodificação automática
- Campos: parceiro, endereço, valor mensal, contrato, cliente, banda, SAP, etc.
- Busca por raio geográfico a partir de um ponto
- Histórico de compras LM

### 🛒 Carrinho e Envio via Webhook
- Seleção e envio em lote de viabilidades aprovadas
- Validação de campos obrigatórios antes do envio
- Integração com **Power Automate** via webhook HTTP (POST)
- Histórico completo de envios (`/send-history`)

### ⚙️ Configurações Admin
- Painel de configurações com editor de URL e token do webhook
- **Mapeamento de campos JSON** configurável sem alteração de código
- Gestão de provedores: nome, cor, distância LPU máxima, multiplicador
- Tabela LPU por tipo de link e provedor
- Atualização de rede NTT
- Gestão de usuários WS

---

## 🏗️ Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Plataforma | [Lovable](https://lovable.dev) |
| Framework | React 18 + TypeScript + Vite |
| Estilo | Tailwind CSS + shadcn/ui (Radix UI) |
| Auth & Database | [Supabase](https://supabase.com) |
| Roteamento | React Router DOM v6 |
| Estado assíncrono | TanStack Query v5 |
| Mapas | Leaflet + react-leaflet |
| Exportação Excel | SheetJS (xlsx) |
| Gráficos | Recharts |
| Formulários | React Hook Form + Zod |
| Geo (KML/KMZ) | @tmcw/togeojson + jszip |
| Notificações | Sonner + shadcn/ui Toaster |
| Captura de tela | html2canvas |
| Testes | Vitest + Testing Library |
| Build | Vite 5 |

---

## 🗄️ Banco de Dados (Supabase).

Tabelas principais gerenciadas via migrations:

| Tabela | Descrição |
|---|---|
| `profiles` | Perfil do usuário (criado automaticamente via trigger no signup) |
| `user_roles` | Roles por usuário (`admin` \| `ws_user`) com flag `is_active` |
| `providers` | Provedores de fibra (nome, cor, distância LPU, multiplicador) |
| `lpu_items` | Tabela de preços LPU por tipo de link e provedor |
| `geo_elements` | Elementos geográficos importados por provedor (ponto, linha, polígono) |
| `feasibility_queries` | Histórico de consultas de viabilidade individuais |
| `configuracoes` | Configurações do sistema (webhook, field_mapping) em formato chave/valor |
| `compras_lm` | Base last mile importada (endereços, valores, contratos) |
| `import_profiles` | Perfis de mapeamento de colunas salvos pelo usuário |

---

## 🔄 Fluxo de Integração Webhook

```
FibraMap (carrinho de envio)
        │
        ▼ POST application/json
Power Automate Flow (HTTP Trigger)
        │
        ├─ Campos raiz: solicitante, dataEnvio, dataAnalise, origemLista
        │
        └─ Array itens[]:
              campos configurados via painel admin
              (ex: Vigência, Produto Link IP, Tecnologia,
                   Cidade Ponto A, CNPJ Cliente, Coordenadas...)
                        │
                        ▼
              Microsoft Lists / SharePoint
```

### Formato de Mapeamento de Campos

Configurado no painel admin (`/settings`), sem necessidade de alterar código:

```json
[
  {
    "colunaApp": "Nome exibido na tabela",
    "campoJson": "campo_no_payload",
    "tipo": "string"
  }
]
```

---

## 🚀 Como Executar Localmente

```bash
# Clone o repositório
git clone https://github.com/Elcio-Prog/fibramap.git
cd fibramap

# Instale as dependências (recomendado: bun ou npm)
npm install
# ou
bun install

# Configure as variáveis de ambiente
cp .env.example .env
# Preencha com seus valores do Supabase
```

### Variáveis de Ambiente

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
```

> A URL do webhook e o token são configurados diretamente no painel admin do app, salvos na tabela `configuracoes` do Supabase.

```bash
# Inicie o servidor de desenvolvimento
npm run dev

# Build de produção
npm run build

# Executar testes
npm run test
```

---

## 📁 Estrutura do Projeto

```
fibramap/
├── src/
│   ├── components/
│   │   ├── cart/          # Carrinho de envio (drawer, edição, seleção)
│   │   ├── lm/            # Import wizard, formulário manual, busca por raio
│   │   ├── map/           # Barra de busca do mapa
│   │   ├── ws/            # Upload e processamento em lote WS
│   │   └── ui/            # Componentes shadcn/ui
│   ├── contexts/
│   │   ├── AuthContext.tsx    # Autenticação Supabase
│   │   └── CartContext.tsx    # Estado global do carrinho
│   ├── hooks/
│   │   ├── useConfig.ts          # Configurações (webhook, mapeamento)
│   │   ├── useUserRole.ts        # Roles do usuário logado
│   │   ├── useFeasibility.ts     # Consultas de viabilidade
│   │   ├── useProviders.ts       # CRUD de provedores
│   │   ├── useGeoElements.ts     # Elementos geográficos do mapa
│   │   ├── useComprasLM.ts       # Base last mile
│   │   ├── useLpuItems.ts        # Tabela LPU
│   │   ├── useImportProfiles.ts  # Perfis de importação
│   │   └── useBulkExport.ts      # Exportação Excel
│   ├── lib/
│   │   ├── geo-utils.ts               # Motor geográfico (geocode, rota, NTT, CPFL...)
│   │   ├── ws-feasibility-engine.ts   # Motor de viabilidade em lote
│   │   ├── ws-utils.ts                # Helpers WS
│   │   ├── cep-utils.ts               # Consulta de CEP
│   │   └── field-options.ts           # Opções de campos
│   ├── pages/
│   │   ├── MapPage.tsx              # Mapa interativo (admin)
│   │   ├── FeasibilityPage.tsx      # Viabilidade individual
│   │   ├── BaseLMPage.tsx           # Base last mile
│   │   ├── ProvidersPage.tsx        # Gestão de provedores
│   │   ├── SettingsPage.tsx         # Configurações (webhook + mapeamento)
│   │   ├── HistoryPage.tsx          # Histórico de consultas
│   │   ├── SendHistoryPage.tsx      # Histórico de envios webhook
│   │   ├── NttNetworkUpdatePage.tsx # Atualização rede NTT
│   │   ├── WsUploadPage.tsx         # Upload em lote WS
│   │   ├── WsSingleSearch.tsx       # Busca pontual WS
│   │   ├── WsSearchesPage.tsx       # Lista de lotes WS
│   │   ├── WsBatchDetailPage.tsx    # Detalhe de lote WS
│   │   ├── WsUsersPage.tsx          # Gestão de usuários WS
│   │   ├── PreProvidersPage.tsx     # Pré-provedores
│   │   ├── LandingPage.tsx          # Página inicial (seleção de área)
│   │   └── Auth.tsx                 # Login
│   ├── integrations/supabase/       # Cliente e tipos gerados do Supabase
│   └── App.tsx                      # Rotas e proteção por role
├── supabase/
│   ├── config.toml
│   ├── functions/                   # Edge Functions
│   └── migrations/                  # Histórico completo de migrações SQL
├── public/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

---

## 🔐 Controle de Acesso por Rota

| Área | Role necessária | Rotas |
|---|---|---|
| App principal | `admin` | `/`, `/providers`, `/feasibility`, `/base-lm`, `/history`, `/settings`, `/send-history`, `/ntt-update`, `/ws-users`, `/ws-upload`, `/ws-single` |
| Ferramenta WS | `ws_user` ou `admin` | `/ws/`, `/ws/searches`, `/ws/batch/:id`, `/ws/single`, `/ws/pre-providers`, `/ws/send-history` |
| Público | — | `/landing`, `/auth`, `/ws/login` |

---

## 🧪 Testes

```bash
# Executar testes uma vez
npm run test

# Modo watch
npm run test:watch
```

Testes configurados com **Vitest** + **@testing-library/react** + **jsdom**.

---

## 📄 Licença

Projeto interno. Todos os direitos reservados.
