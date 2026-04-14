export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      api_request_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          endpoint: string
          error_message: string | null
          id: string
          integration_name: string
          method: string
          request_params: Json | null
          response_body: Json | null
          response_ok: boolean | null
          response_status: number | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          endpoint: string
          error_message?: string | null
          id?: string
          integration_name: string
          method?: string
          request_params?: Json | null
          response_body?: Json | null
          response_ok?: boolean | null
          response_status?: number | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          endpoint?: string
          error_message?: string | null
          id?: string
          integration_name?: string
          method?: string
          request_params?: Json | null
          response_body?: Json | null
          response_ok?: boolean | null
          response_status?: number | null
        }
        Relationships: []
      }
      compras_lm: {
        Row: {
          banda_mbps: number | null
          cidade: string | null
          cliente: string | null
          codigo_sap: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          endereco: string
          geocoding_status: string
          id: string
          id_etiqueta: string | null
          lat: number | null
          lng: number | null
          nr_contrato: string | null
          observacoes: string | null
          parceiro: string
          setup: number | null
          status: string
          uf: string | null
          updated_at: string
          user_id: string | null
          valor_mensal: number
        }
        Insert: {
          banda_mbps?: number | null
          cidade?: string | null
          cliente?: string | null
          codigo_sap?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          endereco: string
          geocoding_status?: string
          id?: string
          id_etiqueta?: string | null
          lat?: number | null
          lng?: number | null
          nr_contrato?: string | null
          observacoes?: string | null
          parceiro: string
          setup?: number | null
          status?: string
          uf?: string | null
          updated_at?: string
          user_id?: string | null
          valor_mensal: number
        }
        Update: {
          banda_mbps?: number | null
          cidade?: string | null
          cliente?: string | null
          codigo_sap?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          endereco?: string
          geocoding_status?: string
          id?: string
          id_etiqueta?: string | null
          lat?: number | null
          lng?: number | null
          nr_contrato?: string | null
          observacoes?: string | null
          parceiro?: string
          setup?: number | null
          status?: string
          uf?: string | null
          updated_at?: string
          user_id?: string | null
          valor_mensal?: number
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          chave: string
          id: string
          updated_at: string
          updated_by: string | null
          valor: Json
        }
        Insert: {
          chave: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          valor?: Json
        }
        Update: {
          chave?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          valor?: Json
        }
        Relationships: []
      }
      custo_por_mega: {
        Row: {
          created_at: string | null
          id: string
          identificacao: string
          updated_at: string | null
          valor_l2l: number | null
          valor_link: number | null
          valor_link_empresa: number | null
          valor_link_flex: number | null
          valor_link_full: number | null
          valor_ptt: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          identificacao: string
          updated_at?: string | null
          valor_l2l?: number | null
          valor_link?: number | null
          valor_link_empresa?: number | null
          valor_link_flex?: number | null
          valor_link_full?: number | null
          valor_ptt?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          identificacao?: string
          updated_at?: string | null
          valor_l2l?: number | null
          valor_link?: number | null
          valor_link_empresa?: number | null
          valor_link_flex?: number | null
          valor_link_full?: number | null
          valor_ptt?: number | null
        }
        Relationships: []
      }
      custo_voz_geral: {
        Row: {
          created_at: string | null
          custo_minuto: number | null
          descricao: string
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custo_minuto?: number | null
          descricao: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custo_minuto?: number | null
          descricao?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      custos_voz_pais: {
        Row: {
          carga_tributaria: number | null
          created_at: string | null
          custo_final: number | null
          custo_minuto: number | null
          id: string
          pais: string
          updated_at: string | null
        }
        Insert: {
          carga_tributaria?: number | null
          created_at?: string | null
          custo_final?: number | null
          custo_minuto?: number | null
          id?: string
          pais: string
          updated_at?: string | null
        }
        Update: {
          carga_tributaria?: number | null
          created_at?: string | null
          custo_final?: number | null
          custo_minuto?: number | null
          id?: string
          pais?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      equipamentos_valor: {
        Row: {
          created_at: string | null
          descricao: string | null
          equipamento: string
          id: string
          imposto: number | null
          updated_at: string | null
          valor: number | null
          valor_dolar: number | null
          valor_final: number | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          equipamento: string
          id?: string
          imposto?: number | null
          updated_at?: string | null
          valor?: number | null
          valor_dolar?: number | null
          valor_final?: number | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          equipamento?: string
          id?: string
          imposto?: number | null
          updated_at?: string | null
          valor?: number | null
          valor_dolar?: number | null
          valor_final?: number | null
        }
        Relationships: []
      }
      feasibility_queries: {
        Row: {
          calculated_distance_m: number | null
          created_at: string
          customer_address: string
          customer_lat: number | null
          customer_lng: number | null
          final_value: number | null
          id: string
          is_viable: boolean | null
          lpu_value: number | null
          multiplier: number | null
          notes: string | null
          provider_id: string | null
          user_id: string | null
        }
        Insert: {
          calculated_distance_m?: number | null
          created_at?: string
          customer_address: string
          customer_lat?: number | null
          customer_lng?: number | null
          final_value?: number | null
          id?: string
          is_viable?: boolean | null
          lpu_value?: number | null
          multiplier?: number | null
          notes?: string | null
          provider_id?: string | null
          user_id?: string | null
        }
        Update: {
          calculated_distance_m?: number | null
          created_at?: string
          customer_address?: string
          customer_lat?: number | null
          customer_lng?: number | null
          final_value?: number | null
          id?: string
          is_viable?: boolean | null
          lpu_value?: number | null
          multiplier?: number | null
          notes?: string | null
          provider_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feasibility_queries_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_elements: {
        Row: {
          created_at: string
          element_type: string
          geometry: Json
          id: string
          properties: Json | null
          provider_id: string
        }
        Insert: {
          created_at?: string
          element_type?: string
          geometry: Json
          id?: string
          properties?: Json | null
          provider_id: string
        }
        Update: {
          created_at?: string
          element_type?: string
          geometry?: Json
          id?: string
          properties?: Json | null
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_elements_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      geogrid_viabilidade_cache: {
        Row: {
          created_at: string
          enriched: boolean
          fibras: number
          fibras_livres: number
          fibras_ocupadas: number
          geogrid_id: string
          id: string
          item: string
          latitude: number | null
          longitude: number | null
          pasta_nome: string
          portas: number
          portas_livres: number
          portas_ocupadas: number
          recipiente_id: string
          recipiente_item: string
          recipiente_sigla: string
          sigla: string
          sigla_poste: string
          status_viabilidade: string
          tipo_splitter: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enriched?: boolean
          fibras?: number
          fibras_livres?: number
          fibras_ocupadas?: number
          geogrid_id: string
          id?: string
          item?: string
          latitude?: number | null
          longitude?: number | null
          pasta_nome?: string
          portas?: number
          portas_livres?: number
          portas_ocupadas?: number
          recipiente_id?: string
          recipiente_item?: string
          recipiente_sigla?: string
          sigla?: string
          sigla_poste?: string
          status_viabilidade?: string
          tipo_splitter?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enriched?: boolean
          fibras?: number
          fibras_livres?: number
          fibras_ocupadas?: number
          geogrid_id?: string
          id?: string
          item?: string
          latitude?: number | null
          longitude?: number | null
          pasta_nome?: string
          portas?: number
          portas_livres?: number
          portas_ocupadas?: number
          recipiente_id?: string
          recipiente_item?: string
          recipiente_sigla?: string
          sigla?: string
          sigla_poste?: string
          status_viabilidade?: string
          tipo_splitter?: string
          updated_at?: string
        }
        Relationships: []
      }
      import_profiles: {
        Row: {
          column_mapping: Json
          created_at: string
          id: string
          key_field: string
          name: string
          user_id: string | null
        }
        Insert: {
          column_mapping?: Json
          created_at?: string
          id?: string
          key_field?: string
          name: string
          user_id?: string | null
        }
        Update: {
          column_mapping?: Json
          created_at?: string
          id?: string
          key_field?: string
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      integracoes: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          tipo: string
          token: string
          updated_at: string
          url: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          tipo?: string
          token?: string
          updated_at?: string
          url?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          tipo?: string
          token?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      logs_envio_sharepoint: {
        Row: {
          data_envio: string
          id: string
          id_lote: string
          mensagem_erro: string | null
          quantidade_itens: number
          response_code: number | null
          status: string
          user_id: string
          usuario_email: string
        }
        Insert: {
          data_envio?: string
          id?: string
          id_lote: string
          mensagem_erro?: string | null
          quantidade_itens?: number
          response_code?: number | null
          status?: string
          user_id: string
          usuario_email: string
        }
        Update: {
          data_envio?: string
          id?: string
          id_lote?: string
          mensagem_erro?: string | null
          quantidade_itens?: number
          response_code?: number | null
          status?: string
          user_id?: string
          usuario_email?: string
        }
        Relationships: []
      }
      lpu_items: {
        Row: {
          created_at: string
          id: string
          link_type: string
          provider_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          link_type: string
          provider_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          link_type?: string
          provider_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "lpu_items_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_provider_cities: {
        Row: {
          cidade: string
          created_at: string
          estado: string | null
          id: string
          pre_provider_id: string
        }
        Insert: {
          cidade: string
          created_at?: string
          estado?: string | null
          id?: string
          pre_provider_id: string
        }
        Update: {
          cidade?: string
          created_at?: string
          estado?: string | null
          id?: string
          pre_provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pre_provider_cities_pre_provider_id_fkey"
            columns: ["pre_provider_id"]
            isOneToOne: false
            referencedRelation: "pre_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_providers: {
        Row: {
          cidade_sede: string | null
          contato_comercial_email: string | null
          contato_comercial_fone: string | null
          contato_comercial_nome: string | null
          contato_noc_email: string | null
          contato_noc_fone: string | null
          contato_noc_nome: string | null
          created_at: string
          estado_sede: string | null
          has_cross_ntt: boolean
          id: string
          nome_fantasia: string
          observacoes: string | null
          oferece_mancha: string | null
          promoted_provider_id: string | null
          razao_social: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cidade_sede?: string | null
          contato_comercial_email?: string | null
          contato_comercial_fone?: string | null
          contato_comercial_nome?: string | null
          contato_noc_email?: string | null
          contato_noc_fone?: string | null
          contato_noc_nome?: string | null
          created_at?: string
          estado_sede?: string | null
          has_cross_ntt?: boolean
          id?: string
          nome_fantasia: string
          observacoes?: string | null
          oferece_mancha?: string | null
          promoted_provider_id?: string | null
          razao_social?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cidade_sede?: string | null
          contato_comercial_email?: string | null
          contato_comercial_fone?: string | null
          contato_comercial_nome?: string | null
          contato_noc_email?: string | null
          contato_noc_fone?: string | null
          contato_noc_nome?: string | null
          created_at?: string
          estado_sede?: string | null
          has_cross_ntt?: boolean
          id?: string
          nome_fantasia?: string
          observacoes?: string | null
          oferece_mancha?: string | null
          promoted_provider_id?: string | null
          razao_social?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pre_providers_promoted_provider_id_fkey"
            columns: ["promoted_provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_viabilidades: {
        Row: {
          aprovado_por: string | null
          cnpj_cliente: string | null
          codigo_smark: string | null
          comentarios_aprovador: string | null
          coordenadas: string | null
          created_at: string | null
          criado_por: string | null
          dados_precificacao: Json | null
          data_reavaliacao: string | null
          endereco: string | null
          id: string
          id_guardachuva: string | null
          inviabilidade_tecnica: string | null
          modificado_por: string | null
          motivo_solicitacao: string | null
          nome_cliente: string | null
          numero: number
          observacao_validacao: string | null
          observacoes: string | null
          origem: string | null
          previsao_roi: number | null
          produto_nt: string | null
          projetista: string | null
          protocolo: string | null
          roi_global: number | null
          status: string | null
          status_aprovacao: string | null
          status_viabilidade: string | null
          ticket_mensal: number | null
          tipo_solicitacao: string | null
          updated_at: string | null
          user_id: string
          valor_minimo: number | null
          viabilidade: string | null
          vigencia: number | null
        }
        Insert: {
          aprovado_por?: string | null
          cnpj_cliente?: string | null
          codigo_smark?: string | null
          comentarios_aprovador?: string | null
          coordenadas?: string | null
          created_at?: string | null
          criado_por?: string | null
          dados_precificacao?: Json | null
          data_reavaliacao?: string | null
          endereco?: string | null
          id?: string
          id_guardachuva?: string | null
          inviabilidade_tecnica?: string | null
          modificado_por?: string | null
          motivo_solicitacao?: string | null
          nome_cliente?: string | null
          numero?: number
          observacao_validacao?: string | null
          observacoes?: string | null
          origem?: string | null
          previsao_roi?: number | null
          produto_nt?: string | null
          projetista?: string | null
          protocolo?: string | null
          roi_global?: number | null
          status?: string | null
          status_aprovacao?: string | null
          status_viabilidade?: string | null
          ticket_mensal?: number | null
          tipo_solicitacao?: string | null
          updated_at?: string | null
          user_id: string
          valor_minimo?: number | null
          viabilidade?: string | null
          vigencia?: number | null
        }
        Update: {
          aprovado_por?: string | null
          cnpj_cliente?: string | null
          codigo_smark?: string | null
          comentarios_aprovador?: string | null
          coordenadas?: string | null
          created_at?: string | null
          criado_por?: string | null
          dados_precificacao?: Json | null
          data_reavaliacao?: string | null
          endereco?: string | null
          id?: string
          id_guardachuva?: string | null
          inviabilidade_tecnica?: string | null
          modificado_por?: string | null
          motivo_solicitacao?: string | null
          nome_cliente?: string | null
          numero?: number
          observacao_validacao?: string | null
          observacoes?: string | null
          origem?: string | null
          previsao_roi?: number | null
          produto_nt?: string | null
          projetista?: string | null
          protocolo?: string | null
          roi_global?: number | null
          status?: string | null
          status_aprovacao?: string | null
          status_viabilidade?: string | null
          ticket_mensal?: number | null
          tipo_solicitacao?: string | null
          updated_at?: string | null
          user_id?: string
          valor_minimo?: number | null
          viabilidade?: string | null
          vigencia?: number | null
        }
        Relationships: []
      }
      pre_viabilidades_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_fields: string[]
          id: string
          new_values: Json
          pre_viabilidade_id: string
          snapshot: Json
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[]
          id?: string
          new_values?: Json
          pre_viabilidade_id: string
          snapshot: Json
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[]
          id?: string
          new_values?: Json
          pre_viabilidade_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pre_viabilidades_history_pre_viabilidade_id_fkey"
            columns: ["pre_viabilidade_id"]
            isOneToOne: false
            referencedRelation: "pre_viabilidades"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          full_name: string | null
          id: string
          phone: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      providers: {
        Row: {
          cidade_sede: string | null
          color: string
          contato_comercial_email: string | null
          contato_noc_email: string | null
          contato_noc_fone: string | null
          contato_noc_nome: string | null
          created_at: string
          estado_sede: string | null
          gerente_comercial: string | null
          has_cross_ntt: boolean
          id: string
          max_lpu_distance_m: number
          multiplier: number
          name: string
          observacoes: string | null
          razao_social: string | null
          regras_bloquear_atendimento_nao_sim: boolean
          regras_bloquear_cruzamento_rodovia: boolean
          regras_bloquear_portas_livres_zero: boolean
          regras_bloquear_splitter_1x2: boolean
          regras_bloquear_splitter_des: boolean
          regras_considerar_ce: boolean
          regras_considerar_ta: boolean
          regras_habilitar_exclusao_cpfl: boolean
          regras_usar_porta_disponivel: boolean
          telefone_gerente: string | null
          updated_at: string
          use_saturated_ta: boolean
        }
        Insert: {
          cidade_sede?: string | null
          color?: string
          contato_comercial_email?: string | null
          contato_noc_email?: string | null
          contato_noc_fone?: string | null
          contato_noc_nome?: string | null
          created_at?: string
          estado_sede?: string | null
          gerente_comercial?: string | null
          has_cross_ntt?: boolean
          id?: string
          max_lpu_distance_m?: number
          multiplier?: number
          name: string
          observacoes?: string | null
          razao_social?: string | null
          regras_bloquear_atendimento_nao_sim?: boolean
          regras_bloquear_cruzamento_rodovia?: boolean
          regras_bloquear_portas_livres_zero?: boolean
          regras_bloquear_splitter_1x2?: boolean
          regras_bloquear_splitter_des?: boolean
          regras_considerar_ce?: boolean
          regras_considerar_ta?: boolean
          regras_habilitar_exclusao_cpfl?: boolean
          regras_usar_porta_disponivel?: boolean
          telefone_gerente?: string | null
          updated_at?: string
          use_saturated_ta?: boolean
        }
        Update: {
          cidade_sede?: string | null
          color?: string
          contato_comercial_email?: string | null
          contato_noc_email?: string | null
          contato_noc_fone?: string | null
          contato_noc_nome?: string | null
          created_at?: string
          estado_sede?: string | null
          gerente_comercial?: string | null
          has_cross_ntt?: boolean
          id?: string
          max_lpu_distance_m?: number
          multiplier?: number
          name?: string
          observacoes?: string | null
          razao_social?: string | null
          regras_bloquear_atendimento_nao_sim?: boolean
          regras_bloquear_cruzamento_rodovia?: boolean
          regras_bloquear_portas_livres_zero?: boolean
          regras_bloquear_splitter_1x2?: boolean
          regras_bloquear_splitter_des?: boolean
          regras_considerar_ce?: boolean
          regras_considerar_ta?: boolean
          regras_habilitar_exclusao_cpfl?: boolean
          regras_usar_porta_disponivel?: boolean
          telefone_gerente?: string | null
          updated_at?: string
          use_saturated_ta?: boolean
        }
        Relationships: []
      }
      tabela_custos_pabx: {
        Row: {
          created_at: string | null
          id: string
          identificador: string
          imposto: number | null
          preco: number | null
          preco_final: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          identificador: string
          imposto?: number | null
          preco?: number | null
          preco_final?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          identificador?: string
          imposto?: number | null
          preco?: number | null
          preco_final?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      taxas_link: {
        Row: {
          created_at: string | null
          id: string
          identificacao: string
          margem_lucro: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          identificacao: string
          margem_lucro?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          identificacao?: string
          margem_lucro?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      valor_bloco_ip: {
        Row: {
          created_at: string | null
          id: string
          identificacao: string
          updated_at: string | null
          valor: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          identificacao: string
          updated_at?: string | null
          valor?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          identificacao?: string
          updated_at?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      vigencia_vs_roi: {
        Row: {
          created_at: string | null
          id: string
          meses: string
          roi: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          meses: string
          roi?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          meses?: string
          roi?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ws_batches: {
        Row: {
          created_at: string
          failed_items: number
          file_name: string
          id: string
          parent_batch_id: string | null
          processed_at: string | null
          processed_items: number
          status: string
          title: string | null
          total_items: number
          user_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          failed_items?: number
          file_name: string
          id?: string
          parent_batch_id?: string | null
          processed_at?: string | null
          processed_items?: number
          status?: string
          title?: string | null
          total_items?: number
          user_id: string
          version_number?: number
        }
        Update: {
          created_at?: string
          failed_items?: number
          file_name?: string
          id?: string
          parent_batch_id?: string | null
          processed_at?: string | null
          processed_items?: number
          status?: string
          title?: string | null
          total_items?: number
          user_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "ws_batches_parent_batch_id_fkey"
            columns: ["parent_batch_id"]
            isOneToOne: false
            referencedRelation: "ws_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      ws_feasibility_items: {
        Row: {
          attempt_count: number
          batch_id: string
          bloco_ip: string | null
          cep_a: string | null
          cep_b: string | null
          cidade_a: string | null
          cidade_b: string | null
          cliente: string | null
          cnpj_cliente: string | null
          codigo_smark: string | null
          created_at: string
          data_envio: string | null
          designacao: string | null
          endereco_a: string | null
          endereco_b: string | null
          enviado_para_sharepoint: boolean
          error_message: string | null
          id: string
          id_lote: string | null
          is_l2l: boolean
          is_viable: boolean | null
          l2l_pair_id: string | null
          l2l_suffix: string | null
          lat_a: number | null
          lat_b: number | null
          lng_a: number | null
          lng_b: number | null
          numero_a: string | null
          numero_b: string | null
          observacoes_system: string | null
          observacoes_user: string | null
          observacoes_user_updated_at: string | null
          prazo_ativacao: string | null
          processing_status: string
          produto: string | null
          raw_data: Json
          result_distance_m: number | null
          result_notes: string | null
          result_provider: string | null
          result_stage: string | null
          result_value: number | null
          row_number: number
          taxa_instalacao: number | null
          tecnologia: string | null
          tecnologia_meio_fisico: string | null
          tipo_link: string | null
          tipo_solicitacao: string | null
          uf_a: string | null
          uf_b: string | null
          valor_a_ser_vendido: number | null
          velocidade_mbps: number | null
          velocidade_original: string | null
          vigencia: string | null
        }
        Insert: {
          attempt_count?: number
          batch_id: string
          bloco_ip?: string | null
          cep_a?: string | null
          cep_b?: string | null
          cidade_a?: string | null
          cidade_b?: string | null
          cliente?: string | null
          cnpj_cliente?: string | null
          codigo_smark?: string | null
          created_at?: string
          data_envio?: string | null
          designacao?: string | null
          endereco_a?: string | null
          endereco_b?: string | null
          enviado_para_sharepoint?: boolean
          error_message?: string | null
          id?: string
          id_lote?: string | null
          is_l2l?: boolean
          is_viable?: boolean | null
          l2l_pair_id?: string | null
          l2l_suffix?: string | null
          lat_a?: number | null
          lat_b?: number | null
          lng_a?: number | null
          lng_b?: number | null
          numero_a?: string | null
          numero_b?: string | null
          observacoes_system?: string | null
          observacoes_user?: string | null
          observacoes_user_updated_at?: string | null
          prazo_ativacao?: string | null
          processing_status?: string
          produto?: string | null
          raw_data?: Json
          result_distance_m?: number | null
          result_notes?: string | null
          result_provider?: string | null
          result_stage?: string | null
          result_value?: number | null
          row_number: number
          taxa_instalacao?: number | null
          tecnologia?: string | null
          tecnologia_meio_fisico?: string | null
          tipo_link?: string | null
          tipo_solicitacao?: string | null
          uf_a?: string | null
          uf_b?: string | null
          valor_a_ser_vendido?: number | null
          velocidade_mbps?: number | null
          velocidade_original?: string | null
          vigencia?: string | null
        }
        Update: {
          attempt_count?: number
          batch_id?: string
          bloco_ip?: string | null
          cep_a?: string | null
          cep_b?: string | null
          cidade_a?: string | null
          cidade_b?: string | null
          cliente?: string | null
          cnpj_cliente?: string | null
          codigo_smark?: string | null
          created_at?: string
          data_envio?: string | null
          designacao?: string | null
          endereco_a?: string | null
          endereco_b?: string | null
          enviado_para_sharepoint?: boolean
          error_message?: string | null
          id?: string
          id_lote?: string | null
          is_l2l?: boolean
          is_viable?: boolean | null
          l2l_pair_id?: string | null
          l2l_suffix?: string | null
          lat_a?: number | null
          lat_b?: number | null
          lng_a?: number | null
          lng_b?: number | null
          numero_a?: string | null
          numero_b?: string | null
          observacoes_system?: string | null
          observacoes_user?: string | null
          observacoes_user_updated_at?: string | null
          prazo_ativacao?: string | null
          processing_status?: string
          produto?: string | null
          raw_data?: Json
          result_distance_m?: number | null
          result_notes?: string | null
          result_provider?: string | null
          result_stage?: string | null
          result_value?: number | null
          row_number?: number
          taxa_instalacao?: number | null
          tecnologia?: string | null
          tecnologia_meio_fisico?: string | null
          tipo_link?: string | null
          tipo_solicitacao?: string | null
          uf_a?: string | null
          uf_b?: string | null
          valor_a_ser_vendido?: number | null
          velocidade_mbps?: number | null
          velocidade_original?: string | null
          vigencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ws_feasibility_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "ws_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      ws_mapping_profiles: {
        Row: {
          column_mapping: Json
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          column_mapping?: Json
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          column_mapping?: Json
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      ws_single_searches: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_viable: boolean | null
          lat: number | null
          lng: number | null
          result_distance_m: number | null
          result_notes: string | null
          result_provider: string | null
          result_stage: string | null
          result_value: number | null
          search_params: Json
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_viable?: boolean | null
          lat?: number | null
          lng?: number | null
          result_distance_m?: number | null
          result_notes?: string | null
          result_provider?: string | null
          result_stage?: string | null
          result_value?: number | null
          search_params?: Json
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_viable?: boolean | null
          lat?: number | null
          lng?: number | null
          result_distance_m?: number | null
          result_notes?: string | null
          result_provider?: string | null
          result_stage?: string | null
          result_value?: number | null
          search_params?: Json
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "ws_user" | "vendedor" | "implantacao"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "ws_user", "vendedor", "implantacao"],
    },
  },
} as const
