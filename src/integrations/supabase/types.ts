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
      accounts: {
        Row: {
          color: string | null
          created_at: string | null
          currency: string
          current_balance: number | null
          icon: string | null
          id: string
          initial_balance: number | null
          is_active: boolean | null
          name: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          currency?: string
          current_balance?: number | null
          icon?: string | null
          id?: string
          initial_balance?: number | null
          is_active?: boolean | null
          name: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          currency?: string
          current_balance?: number | null
          icon?: string | null
          id?: string
          initial_balance?: number | null
          is_active?: boolean | null
          name?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      budget_lines: {
        Row: {
          budget_id: string
          category_id: string | null
          id: string
          planned_amount_annual: number | null
          planned_amount_monthly: number
          spent_amount: number
          updated_at: string | null
        }
        Insert: {
          budget_id: string
          category_id?: string | null
          id?: string
          planned_amount_annual?: number | null
          planned_amount_monthly?: number
          spent_amount?: number
          updated_at?: string | null
        }
        Update: {
          budget_id?: string
          category_id?: string | null
          id?: string
          planned_amount_annual?: number | null
          planned_amount_monthly?: number
          spent_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_rules: {
        Row: {
          created_at: string | null
          currency: string
          discretionary_ratio: number
          essential_ratio: number
          id: string
          is_active: boolean | null
          rule_type: string
          saving_investing_ratio: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          currency?: string
          discretionary_ratio?: number
          essential_ratio?: number
          id?: string
          is_active?: boolean | null
          rule_type?: string
          saving_investing_ratio?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          currency?: string
          discretionary_ratio?: number
          essential_ratio?: number
          id?: string
          is_active?: boolean | null
          rule_type?: string
          saving_investing_ratio?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          alert_sent: boolean | null
          alert_threshold: number | null
          amount: number
          category_id: string | null
          created_at: string | null
          created_from: string | null
          id: string
          is_active: boolean | null
          month: number | null
          name: string
          period: string
          spent: number | null
          updated_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          alert_sent?: boolean | null
          alert_threshold?: number | null
          amount: number
          category_id?: string | null
          created_at?: string | null
          created_from?: string | null
          id?: string
          is_active?: boolean | null
          month?: number | null
          name: string
          period: string
          spent?: number | null
          updated_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          alert_sent?: boolean | null
          alert_threshold?: number | null
          amount?: number
          category_id?: string | null
          created_at?: string | null
          created_from?: string | null
          id?: string
          is_active?: boolean | null
          month?: number | null
          name?: string
          period?: string
          spent?: number | null
          updated_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          bucket: string | null
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_system: boolean | null
          keywords: string[] | null
          name: string
          parent_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          bucket?: string | null
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          keywords?: string[] | null
          name: string
          parent_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          bucket?: string | null
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          keywords?: string[] | null
          name?: string
          parent_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string | null
          decimal_places: number | null
          id: string
          name: string
          symbol: string
        }
        Insert: {
          code: string
          created_at?: string | null
          decimal_places?: number | null
          id?: string
          name: string
          symbol: string
        }
        Update: {
          code?: string
          created_at?: string | null
          decimal_places?: number | null
          id?: string
          name?: string
          symbol?: string
        }
        Relationships: []
      }
      debt_payments: {
        Row: {
          amount: number
          created_at: string | null
          debt_id: string
          id: string
          notes: string | null
          payment_date: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          debt_id: string
          id?: string
          notes?: string | null
          payment_date?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          debt_id?: string
          id?: string
          notes?: string | null
          payment_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          created_at: string | null
          creditor: string | null
          currency: string
          current_balance: number
          due_day: number | null
          id: string
          interest_rate: number | null
          is_active: boolean | null
          minimum_payment: number | null
          name: string
          original_amount: number
          start_date: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          creditor?: string | null
          currency?: string
          current_balance: number
          due_day?: number | null
          id?: string
          interest_rate?: number | null
          is_active?: boolean | null
          minimum_payment?: number | null
          name: string
          original_amount: number
          start_date?: string | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          creditor?: string | null
          currency?: string
          current_balance?: number
          due_day?: number | null
          id?: string
          interest_rate?: number | null
          is_active?: boolean | null
          minimum_payment?: number | null
          name?: string
          original_amount?: number
          start_date?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ebooks: {
        Row: {
          author: string | null
          collection: string | null
          cover_url: string | null
          created_at: string | null
          description: string | null
          file_url: string | null
          id: string
          is_downloaded: boolean | null
          last_read_at: string | null
          progress: number | null
          title: string
          user_id: string
        }
        Insert: {
          author?: string | null
          collection?: string | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          file_url?: string | null
          id?: string
          is_downloaded?: boolean | null
          last_read_at?: string | null
          progress?: number | null
          title: string
          user_id: string
        }
        Update: {
          author?: string | null
          collection?: string | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          file_url?: string | null
          id?: string
          is_downloaded?: boolean | null
          last_read_at?: string | null
          progress?: number | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      emergency_fund: {
        Row: {
          created_at: string | null
          currency: string
          current_amount: number | null
          goal_amount: number
          id: string
          monthly_target: number | null
          months_of_expenses: number | null
          notes: string | null
          target_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          currency?: string
          current_amount?: number | null
          goal_amount: number
          id?: string
          monthly_target?: number | null
          months_of_expenses?: number | null
          notes?: string | null
          target_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          currency?: string
          current_amount?: number | null
          goal_amount?: number
          id?: string
          monthly_target?: number | null
          months_of_expenses?: number | null
          notes?: string | null
          target_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      emergency_fund_contributions: {
        Row: {
          amount: number
          contribution_date: string
          created_at: string | null
          fund_id: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          amount: number
          contribution_date?: string
          created_at?: string | null
          fund_id: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          contribution_date?: string
          created_at?: string | null
          fund_id?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_fund_contributions_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "emergency_fund"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          created_at: string | null
          date: string
          from_currency: string
          id: string
          rate: number
          to_currency: string
        }
        Insert: {
          created_at?: string | null
          date?: string
          from_currency: string
          id?: string
          rate: number
          to_currency: string
        }
        Update: {
          created_at?: string | null
          date?: string
          from_currency?: string
          id?: string
          rate?: number
          to_currency?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          base_currency: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          base_currency?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          base_currency?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          amount_in_base: number | null
          category_id: string | null
          created_at: string | null
          currency: string
          description: string | null
          exchange_rate: number | null
          id: string
          is_recurring: boolean | null
          notes: string | null
          recurring_frequency: string | null
          related_account_id: string | null
          transaction_date: string
          type: string
          updated_at: string | null
          user_id: string
          voice_transcript: string | null
        }
        Insert: {
          account_id: string
          amount: number
          amount_in_base?: number | null
          category_id?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          exchange_rate?: number | null
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          recurring_frequency?: string | null
          related_account_id?: string | null
          transaction_date?: string
          type: string
          updated_at?: string | null
          user_id: string
          voice_transcript?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          amount_in_base?: number | null
          category_id?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          exchange_rate?: number | null
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          recurring_frequency?: string | null
          related_account_id?: string | null
          transaction_date?: string
          type?: string
          updated_at?: string | null
          user_id?: string
          voice_transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_related_account_id_fkey"
            columns: ["related_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          amount_from: number
          amount_to: number
          created_at: string | null
          created_from: string
          currency_from: string
          currency_to: string
          description: string | null
          from_account_id: string
          fx_rate: number | null
          id: string
          to_account_id: string
          transfer_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_from: number
          amount_to: number
          created_at?: string | null
          created_from?: string
          currency_from?: string
          currency_to?: string
          description?: string | null
          from_account_id: string
          fx_rate?: number | null
          id?: string
          to_account_id: string
          transfer_date?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_from?: number
          amount_to?: number
          created_at?: string | null
          created_from?: string
          currency_from?: string
          currency_to?: string
          description?: string | null
          from_account_id?: string
          fx_rate?: number | null
          id?: string
          to_account_id?: string
          transfer_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_logs: {
        Row: {
          confidence: number | null
          created_at: string | null
          error: string | null
          id: string
          parsed_json: Json | null
          transcript_raw: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          error?: string | null
          id?: string
          parsed_json?: Json | null
          transcript_raw?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          error?: string | null
          id?: string
          parsed_json?: Json | null
          transcript_raw?: string | null
          user_id?: string
        }
        Relationships: []
      }
      voice_rules: {
        Row: {
          category_id: string | null
          created_at: string | null
          id: string
          keyword: string
          priority: number | null
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          id?: string
          keyword: string
          priority?: number | null
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          id?: string
          keyword?: string
          priority?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
