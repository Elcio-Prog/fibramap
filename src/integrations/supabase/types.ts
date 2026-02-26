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
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      providers: {
        Row: {
          color: string
          created_at: string
          gerente_comercial: string | null
          has_cross_ntt: boolean
          id: string
          max_lpu_distance_m: number
          multiplier: number
          name: string
          regras_bloquear_atendimento_nao_sim: boolean
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
          color?: string
          created_at?: string
          gerente_comercial?: string | null
          has_cross_ntt?: boolean
          id?: string
          max_lpu_distance_m?: number
          multiplier?: number
          name: string
          regras_bloquear_atendimento_nao_sim?: boolean
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
          color?: string
          created_at?: string
          gerente_comercial?: string | null
          has_cross_ntt?: boolean
          id?: string
          max_lpu_distance_m?: number
          multiplier?: number
          name?: string
          regras_bloquear_atendimento_nao_sim?: boolean
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
      ws_batches: {
        Row: {
          created_at: string
          file_name: string
          id: string
          processed_at: string | null
          status: string
          total_items: number
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          processed_at?: string | null
          status?: string
          total_items?: number
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          processed_at?: string | null
          status?: string
          total_items?: number
          user_id?: string
        }
        Relationships: []
      }
      ws_feasibility_items: {
        Row: {
          batch_id: string
          cidade_a: string | null
          cidade_b: string | null
          cliente: string | null
          created_at: string
          designacao: string | null
          endereco_a: string | null
          endereco_b: string | null
          id: string
          is_l2l: boolean
          is_viable: boolean | null
          l2l_pair_id: string | null
          l2l_suffix: string | null
          lat_a: number | null
          lat_b: number | null
          lng_a: number | null
          lng_b: number | null
          processing_status: string
          raw_data: Json
          result_notes: string | null
          result_provider: string | null
          result_stage: string | null
          result_value: number | null
          row_number: number
          tipo_link: string | null
          uf_a: string | null
          uf_b: string | null
          velocidade_mbps: number | null
          velocidade_original: string | null
        }
        Insert: {
          batch_id: string
          cidade_a?: string | null
          cidade_b?: string | null
          cliente?: string | null
          created_at?: string
          designacao?: string | null
          endereco_a?: string | null
          endereco_b?: string | null
          id?: string
          is_l2l?: boolean
          is_viable?: boolean | null
          l2l_pair_id?: string | null
          l2l_suffix?: string | null
          lat_a?: number | null
          lat_b?: number | null
          lng_a?: number | null
          lng_b?: number | null
          processing_status?: string
          raw_data?: Json
          result_notes?: string | null
          result_provider?: string | null
          result_stage?: string | null
          result_value?: number | null
          row_number: number
          tipo_link?: string | null
          uf_a?: string | null
          uf_b?: string | null
          velocidade_mbps?: number | null
          velocidade_original?: string | null
        }
        Update: {
          batch_id?: string
          cidade_a?: string | null
          cidade_b?: string | null
          cliente?: string | null
          created_at?: string
          designacao?: string | null
          endereco_a?: string | null
          endereco_b?: string | null
          id?: string
          is_l2l?: boolean
          is_viable?: boolean | null
          l2l_pair_id?: string | null
          l2l_suffix?: string | null
          lat_a?: number | null
          lat_b?: number | null
          lng_a?: number | null
          lng_b?: number | null
          processing_status?: string
          raw_data?: Json
          result_notes?: string | null
          result_provider?: string | null
          result_stage?: string | null
          result_value?: number | null
          row_number?: number
          tipo_link?: string | null
          uf_a?: string | null
          uf_b?: string | null
          velocidade_mbps?: number | null
          velocidade_original?: string | null
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
      app_role: "admin" | "ws_user"
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
      app_role: ["admin", "ws_user"],
    },
  },
} as const
