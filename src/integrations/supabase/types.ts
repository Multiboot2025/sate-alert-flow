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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      case_managers: {
        Row: {
          email: string
          full_name: string
          id: string
          is_on_call: boolean | null
          specialty: string | null
          user_id: string | null
        }
        Insert: {
          email: string
          full_name: string
          id?: string
          is_on_call?: boolean | null
          specialty?: string | null
          user_id?: string | null
        }
        Update: {
          email?: string
          full_name?: string
          id?: string
          is_on_call?: boolean | null
          specialty?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      emergency_cases: {
        Row: {
          admitted_at: string
          ai_engine: string | null
          assigned_manager_id: string | null
          case_code: string
          chief_complaint: string
          created_at: string
          hospital_id: string | null
          id: string
          policy_id: string | null
          policy_validation_notes: string | null
          policy_validation_status: string | null
          policyholder_id: string | null
          risk_analysis: Json | null
          risk_level: string | null
          risk_score: number | null
          status: string | null
          triage_level: number | null
          updated_at: string
          vital_signs: Json | null
        }
        Insert: {
          admitted_at?: string
          ai_engine?: string | null
          assigned_manager_id?: string | null
          case_code: string
          chief_complaint: string
          created_at?: string
          hospital_id?: string | null
          id?: string
          policy_id?: string | null
          policy_validation_notes?: string | null
          policy_validation_status?: string | null
          policyholder_id?: string | null
          risk_analysis?: Json | null
          risk_level?: string | null
          risk_score?: number | null
          status?: string | null
          triage_level?: number | null
          updated_at?: string
          vital_signs?: Json | null
        }
        Update: {
          admitted_at?: string
          ai_engine?: string | null
          assigned_manager_id?: string | null
          case_code?: string
          chief_complaint?: string
          created_at?: string
          hospital_id?: string | null
          id?: string
          policy_id?: string | null
          policy_validation_notes?: string | null
          policy_validation_status?: string | null
          policyholder_id?: string | null
          risk_analysis?: Json | null
          risk_level?: string | null
          risk_score?: number | null
          status?: string | null
          triage_level?: number | null
          updated_at?: string
          vital_signs?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "emergency_cases_assigned_manager_id_fkey"
            columns: ["assigned_manager_id"]
            isOneToOne: false
            referencedRelation: "case_managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_cases_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_cases_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_cases_policyholder_id_fkey"
            columns: ["policyholder_id"]
            isOneToOne: false
            referencedRelation: "policyholders"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitals: {
        Row: {
          admissions_contact: string
          api_key: string
          city: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          admissions_contact: string
          api_key: string
          city: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          admissions_contact?: string
          api_key?: string
          city?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      medical_history: {
        Row: {
          condition: string
          diagnosed_at: string | null
          icd10_code: string | null
          id: string
          is_preexisting: boolean | null
          notes: string | null
          policyholder_id: string | null
          severity: string | null
        }
        Insert: {
          condition: string
          diagnosed_at?: string | null
          icd10_code?: string | null
          id?: string
          is_preexisting?: boolean | null
          notes?: string | null
          policyholder_id?: string | null
          severity?: string | null
        }
        Update: {
          condition?: string
          diagnosed_at?: string | null
          icd10_code?: string | null
          id?: string
          is_preexisting?: boolean | null
          notes?: string | null
          policyholder_id?: string | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_history_policyholder_id_fkey"
            columns: ["policyholder_id"]
            isOneToOne: false
            referencedRelation: "policyholders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          case_id: string | null
          channel: string
          id: string
          read_at: string | null
          recipient_name: string
          recipient_type: string
          sent_at: string
          status: string | null
          subject: string | null
        }
        Insert: {
          body: string
          case_id?: string | null
          channel: string
          id?: string
          read_at?: string | null
          recipient_name: string
          recipient_type: string
          sent_at?: string
          status?: string | null
          subject?: string | null
        }
        Update: {
          body?: string
          case_id?: string | null
          channel?: string
          id?: string
          read_at?: string | null
          recipient_name?: string
          recipient_type?: string
          sent_at?: string
          status?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "emergency_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          coverage_limit: number
          created_at: string
          deductible: number
          end_date: string
          id: string
          plan_type: string
          policy_number: string
          policyholder_id: string | null
          start_date: string
          status: string
        }
        Insert: {
          coverage_limit: number
          created_at?: string
          deductible?: number
          end_date: string
          id?: string
          plan_type: string
          policy_number: string
          policyholder_id?: string | null
          start_date: string
          status?: string
        }
        Update: {
          coverage_limit?: number
          created_at?: string
          deductible?: number
          end_date?: string
          id?: string
          plan_type?: string
          policy_number?: string
          policyholder_id?: string | null
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "policies_policyholder_id_fkey"
            columns: ["policyholder_id"]
            isOneToOne: false
            referencedRelation: "policyholders"
            referencedColumns: ["id"]
          },
        ]
      }
      policyholders: {
        Row: {
          blood_type: string | null
          created_at: string
          date_of_birth: string
          email: string | null
          full_name: string
          id: string
          national_id: string
          phone: string | null
        }
        Insert: {
          blood_type?: string | null
          created_at?: string
          date_of_birth: string
          email?: string | null
          full_name: string
          id?: string
          national_id: string
          phone?: string | null
        }
        Update: {
          blood_type?: string | null
          created_at?: string
          date_of_birth?: string
          email?: string | null
          full_name?: string
          id?: string
          national_id?: string
          phone?: string | null
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          case_id: string | null
          hospital_id: string | null
          id: string
          payload: Json
          processing_time_ms: number | null
          received_at: string
          response: Json | null
          status_code: number | null
        }
        Insert: {
          case_id?: string | null
          hospital_id?: string | null
          id?: string
          payload: Json
          processing_time_ms?: number | null
          received_at?: string
          response?: Json | null
          status_code?: number | null
        }
        Update: {
          case_id?: string | null
          hospital_id?: string | null
          id?: string
          payload?: Json
          processing_time_ms?: number | null
          received_at?: string
          response?: Json | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "emergency_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
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
