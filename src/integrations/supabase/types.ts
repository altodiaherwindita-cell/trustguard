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
      assessment_invitations: {
        Row: {
          accepted_at: string | null
          assessment_id: string
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          status: string
          token: string
          vendor_id: string
        }
        Insert: {
          accepted_at?: string | null
          assessment_id: string
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          id?: string
          status?: string
          token: string
          vendor_id: string
        }
        Update: {
          accepted_at?: string | null
          assessment_id?: string
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          status?: string
          token?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_invitations_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_invitations_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_responses: {
        Row: {
          answer: Json | null
          assessment_id: string
          id: string
          question_id: string
          updated_at: string
        }
        Insert: {
          answer?: Json | null
          assessment_id: string
          id?: string
          question_id: string
          updated_at?: string
        }
        Update: {
          answer?: Json | null
          assessment_id?: string
          id?: string
          question_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_responses_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          ai_summary: string | null
          category_scores: Json | null
          created_at: string
          id: string
          overall_score: number | null
          recommendations: Json | null
          reviewed_at: string | null
          risk_level: string | null
          risk_score: number | null
          status: string
          strengths: Json | null
          submitted_at: string | null
          vendor_id: string
          weaknesses: Json | null
        }
        Insert: {
          ai_summary?: string | null
          category_scores?: Json | null
          created_at?: string
          id?: string
          overall_score?: number | null
          recommendations?: Json | null
          reviewed_at?: string | null
          risk_level?: string | null
          risk_score?: number | null
          status?: string
          strengths?: Json | null
          submitted_at?: string | null
          vendor_id: string
          weaknesses?: Json | null
        }
        Update: {
          ai_summary?: string | null
          category_scores?: Json | null
          created_at?: string
          id?: string
          overall_score?: number | null
          recommendations?: Json | null
          reviewed_at?: string | null
          risk_level?: string | null
          risk_score?: number | null
          status?: string
          strengths?: Json | null
          submitted_at?: string | null
          vendor_id?: string
          weaknesses?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          category: string
          display_order: number
          id: string
          options: Json | null
          question: string
          risk_impact: string
          type: string
          weight: number
        }
        Insert: {
          category: string
          display_order?: number
          id: string
          options?: Json | null
          question: string
          risk_impact?: string
          type: string
          weight?: number
        }
        Update: {
          category?: string
          display_order?: number
          id?: string
          options?: Json | null
          question?: string
          risk_impact?: string
          type?: string
          weight?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          category: string
          contact_email: string
          created_at: string
          created_by: string | null
          current_risk_level: string | null
          current_risk_score: number | null
          id: string
          industry: string | null
          last_assessment_at: string | null
          name: string
          owner_user_id: string | null
          status: string
        }
        Insert: {
          category?: string
          contact_email: string
          created_at?: string
          created_by?: string | null
          current_risk_level?: string | null
          current_risk_score?: number | null
          id?: string
          industry?: string | null
          last_assessment_at?: string | null
          name: string
          owner_user_id?: string | null
          status?: string
        }
        Update: {
          category?: string
          contact_email?: string
          created_at?: string
          created_by?: string | null
          current_risk_level?: string | null
          current_risk_score?: number | null
          id?: string
          industry?: string | null
          last_assessment_at?: string | null
          name?: string
          owner_user_id?: string | null
          status?: string
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
      is_tprm: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "tprm_analyst" | "vendor"
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
      app_role: ["admin", "tprm_analyst", "vendor"],
    },
  },
} as const
