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
      activity_log: {
        Row: {
          action: Database["public"]["Enums"]["activity_action"]
          actor: string | null
          candidate_id: string
          created_at: string
          id: string
          notes: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["activity_action"]
          actor?: string | null
          candidate_id: string
          created_at?: string
          id?: string
          notes?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["activity_action"]
          actor?: string | null
          candidate_id?: string
          created_at?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      allowed_emails: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      candidates: {
        Row: {
          annual_salary_inr: number | null
          created_at: string
          current_company: string | null
          current_designation: string | null
          current_location: string | null
          education_summary: string | null
          email: string | null
          id: string
          job_id: string
          name: string
          naukri_profile_url: string | null
          notice_period: string | null
          phone: string | null
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"]
          preferred_locations: string | null
          resume_headline: string | null
          resume_text: string | null
          resume_url: string | null
          screening_answers: Json | null
          total_experience_years: number | null
        }
        Insert: {
          annual_salary_inr?: number | null
          created_at?: string
          current_company?: string | null
          current_designation?: string | null
          current_location?: string | null
          education_summary?: string | null
          email?: string | null
          id?: string
          job_id: string
          name: string
          naukri_profile_url?: string | null
          notice_period?: string | null
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          preferred_locations?: string | null
          resume_headline?: string | null
          resume_text?: string | null
          resume_url?: string | null
          screening_answers?: Json | null
          total_experience_years?: number | null
        }
        Update: {
          annual_salary_inr?: number | null
          created_at?: string
          current_company?: string | null
          current_designation?: string | null
          current_location?: string | null
          education_summary?: string | null
          email?: string | null
          id?: string
          job_id?: string
          name?: string
          naukri_profile_url?: string | null
          notice_period?: string | null
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          preferred_locations?: string | null
          resume_headline?: string | null
          resume_text?: string | null
          resume_url?: string | null
          screening_answers?: Json | null
          total_experience_years?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          id: string
          jd_text: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          jd_text?: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          jd_text?: string
          title?: string
        }
        Relationships: []
      }
      match_scores: {
        Row: {
          ai_summary: string | null
          candidate_id: string
          domain_match_score: number | null
          experience_match_score: number | null
          gaps: string[]
          id: string
          overall_score: number
          red_flags: string[]
          scored_at: string
          seniority_match_score: number | null
          strengths: string[]
          tier: Database["public"]["Enums"]["match_tier"]
        }
        Insert: {
          ai_summary?: string | null
          candidate_id: string
          domain_match_score?: number | null
          experience_match_score?: number | null
          gaps?: string[]
          id?: string
          overall_score: number
          red_flags?: string[]
          scored_at?: string
          seniority_match_score?: number | null
          strengths?: string[]
          tier: Database["public"]["Enums"]["match_tier"]
        }
        Update: {
          ai_summary?: string | null
          candidate_id?: string
          domain_match_score?: number | null
          experience_match_score?: number | null
          gaps?: string[]
          id?: string
          overall_score?: number
          red_flags?: string[]
          scored_at?: string
          seniority_match_score?: number | null
          strengths?: string[]
          tier?: Database["public"]["Enums"]["match_tier"]
        }
        Relationships: [
          {
            foreignKeyName: "match_scores_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "candidates"
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
      activity_action:
        | "called"
        | "sms_sent"
        | "email_sent"
        | "stage_changed"
        | "note"
      match_tier: "strong_fit" | "good_fit" | "possible_fit" | "not_fit"
      pipeline_stage:
        | "new"
        | "reviewed"
        | "shortlisted"
        | "contacted"
        | "interviewing"
        | "offered"
        | "rejected"
        | "hired"
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
      activity_action: [
        "called",
        "sms_sent",
        "email_sent",
        "stage_changed",
        "note",
      ],
      match_tier: ["strong_fit", "good_fit", "possible_fit", "not_fit"],
      pipeline_stage: [
        "new",
        "reviewed",
        "shortlisted",
        "contacted",
        "interviewing",
        "offered",
        "rejected",
        "hired",
      ],
    },
  },
} as const
