// AUTO-GENERATED — do not edit manually
// Regenerate: npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts

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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_usage_log: {
        Row: {
          cost_usd: number | null
          created_at: string
          duration_ms: number | null
          error_code: string | null
          feature: string
          id: string
          job_id: string | null
          model_used: string
          success: boolean
          tokens_in: number | null
          tokens_out: number | null
          user_id: string | null
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          feature: string
          id?: string
          job_id?: string | null
          model_used: string
          success?: boolean
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string | null
        }
        Update: {
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          feature?: string
          id?: string
          job_id?: string | null
          model_used?: string
          success?: boolean
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      source_state: {
        Row: {
          source: 'remoteok' | 'wwr' | 'himalayas' | 'workingnomads'
          last_fetched_at: string | null
          last_etag: string | null
          last_modified: string | null
          consecutive_failures: number
          last_error: string | null
          updated_at: string
        }
        Insert: {
          source: 'remoteok' | 'wwr' | 'himalayas' | 'workingnomads'
          last_fetched_at?: string | null
          last_etag?: string | null
          last_modified?: string | null
          consecutive_failures?: number
          last_error?: string | null
          updated_at?: string
        }
        Update: {
          source?: 'remoteok' | 'wwr' | 'himalayas' | 'workingnomads'
          last_fetched_at?: string | null
          last_etag?: string | null
          last_modified?: string | null
          consecutive_failures?: number
          last_error?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cron_runs: {
        Row: {
          completed_at: string | null
          cron_name: string
          duration_ms: number | null
          emails_sent: number | null
          error_message: string | null
          id: string
          jobs_failed: number | null
          jobs_fetched: number | null
          jobs_new: number | null
          jobs_skipped: number | null
          metadata: Json | null
          rows_deleted: number | null
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          cron_name: string
          duration_ms?: number | null
          emails_sent?: number | null
          error_message?: string | null
          id?: string
          jobs_failed?: number | null
          jobs_fetched?: number | null
          jobs_new?: number | null
          jobs_skipped?: number | null
          metadata?: Json | null
          rows_deleted?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          cron_name?: string
          duration_ms?: number | null
          emails_sent?: number | null
          error_message?: string | null
          id?: string
          jobs_failed?: number | null
          jobs_fetched?: number | null
          jobs_new?: number | null
          jobs_skipped?: number | null
          metadata?: Json | null
          rows_deleted?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      email_digests: {
        Row: {
          clicked_at: string | null
          id: string
          jobs_included: Json
          opened_at: string | null
          resend_email_id: string | null
          sent_at: string
          user_id: string
        }
        Insert: {
          clicked_at?: string | null
          id?: string
          jobs_included?: Json
          opened_at?: string | null
          resend_email_id?: string | null
          sent_at?: string
          user_id: string
        }
        Update: {
          clicked_at?: string | null
          id?: string
          jobs_included?: Json
          opened_at?: string | null
          resend_email_id?: string | null
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback_extraction: {
        Row: {
          comment: string | null
          correct_value: string | null
          created_at: string
          field_name: string
          id: string
          job_id: string
          reported_value: string | null
          reviewed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          correct_value?: string | null
          created_at?: string
          field_name: string
          id?: string
          job_id: string
          reported_value?: string | null
          reviewed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          correct_value?: string | null
          created_at?: string
          field_name?: string
          id?: string
          job_id?: string
          reported_value?: string | null
          reviewed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_extraction_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_views: {
        Row: {
          action: string
          created_at: string
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_views_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          allowed_countries: string[] | null
          allowed_regions: string[] | null
          company: string
          confidence_scores: Json | null
          contract_type: string | null
          description: string
          embedding: string | null
          excluded_countries: string[] | null
          extracted_at: string | null
          geo_policy: string | null
          hash_dedup: string
          id: string
          ingested_at: string
          logo_url: string | null
          posted_at: string | null
          red_flags: Json
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          salary_period: string | null
          seniority: string | null
          skills_nice_to_have: string[]
          skills_required: string[]
          source: string
          source_id: string | null
          source_url: string
          status: string
          title: string
          tz_min_overlap_hours: number | null
          tz_reference: string | null
          tz_requirement_type: string | null
          visa_sponsorship: string | null
        }
        Insert: {
          allowed_countries?: string[] | null
          allowed_regions?: string[] | null
          company: string
          confidence_scores?: Json | null
          contract_type?: string | null
          description: string
          embedding?: string | null
          excluded_countries?: string[] | null
          extracted_at?: string | null
          geo_policy?: string | null
          hash_dedup: string
          id?: string
          ingested_at?: string
          logo_url?: string | null
          posted_at?: string | null
          red_flags?: Json
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string | null
          seniority?: string | null
          skills_nice_to_have?: string[]
          skills_required?: string[]
          source: string
          source_id?: string | null
          source_url: string
          status?: string
          title: string
          tz_min_overlap_hours?: number | null
          tz_reference?: string | null
          tz_requirement_type?: string | null
          visa_sponsorship?: string | null
        }
        Update: {
          allowed_countries?: string[] | null
          allowed_regions?: string[] | null
          company?: string
          confidence_scores?: Json | null
          contract_type?: string | null
          description?: string
          embedding?: string | null
          excluded_countries?: string[] | null
          extracted_at?: string | null
          geo_policy?: string | null
          hash_dedup?: string
          id?: string
          ingested_at?: string
          logo_url?: string | null
          posted_at?: string | null
          red_flags?: Json
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string | null
          seniority?: string | null
          skills_nice_to_have?: string[]
          skills_required?: string[]
          source?: string
          source_id?: string | null
          source_url?: string
          status?: string
          title?: string
          tz_min_overlap_hours?: number | null
          tz_reference?: string | null
          tz_requirement_type?: string | null
          visa_sponsorship?: string | null
        }
        Relationships: []
      }
      saved_jobs: {
        Row: {
          id: string
          job_id: string
          notes: string | null
          saved_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          job_id: string
          notes?: string | null
          saved_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          job_id?: string
          notes?: string | null
          saved_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          trial_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          bio: string | null
          contract_preference: string
          created_at: string
          display_name: string | null
          embedding: string | null
          excluded_regions: string[]
          language: string
          min_rate_usd: number | null
          onboarding_completed_at: string | null
          rate_period: string | null
          skills: Json
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          contract_preference: string
          created_at?: string
          display_name?: string | null
          embedding?: string | null
          excluded_regions?: string[]
          language?: string
          min_rate_usd?: number | null
          onboarding_completed_at?: string | null
          rate_period?: string | null
          skills?: Json
          timezone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          contract_preference?: string
          created_at?: string
          display_name?: string | null
          embedding?: string | null
          excluded_regions?: string[]
          language?: string
          min_rate_usd?: number | null
          onboarding_completed_at?: string | null
          rate_period?: string | null
          skills?: Json
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_data: { Args: never; Returns: Json }
      ensure_subscription_row: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      free_tier_remaining: { Args: { p_user_id: string }; Returns: number }
      match_jobs_for_user: {
        Args: {
          p_contract_type?: string
          p_geo_policy?: string
          p_limit?: number
          p_min_salary?: number
          p_offset?: number
          p_search_query?: string
          p_seniority?: string
          p_skills?: string[]
          p_user_id: string
        }
        Returns: {
          allowed_countries: string[]
          allowed_regions: string[]
          company: string
          confidence_scores: Json
          contract_type: string
          fit_score: number
          geo_policy: string
          id: string
          is_saved: boolean
          logo_url: string
          posted_at: string
          red_flags: Json
          salary_currency: string
          salary_max: number
          salary_min: number
          salary_period: string
          seniority: string
          skills_required: string[]
          source_url: string
          title: string
          tz_min_overlap_hours: number
          tz_reference: string
          tz_requirement_type: string
        }[]
      }
      upsert_subscription: {
        Args: {
          p_cancel_at_period_end?: boolean
          p_current_period_end?: string
          p_status: string
          p_stripe_customer_id: string
          p_stripe_subscription_id: string
          p_tier: string
          p_trial_end?: string
          p_user_id: string
        }
        Returns: undefined
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
