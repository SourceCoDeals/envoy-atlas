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
      alert_configs: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          is_enabled: boolean | null
          notify_email: boolean | null
          notify_slack: boolean | null
          slack_webhook_url: string | null
          threshold_value: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          notify_email?: boolean | null
          notify_slack?: boolean | null
          slack_webhook_url?: string | null
          threshold_value?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          notify_email?: boolean | null
          notify_slack?: boolean | null
          slack_webhook_url?: string | null
          threshold_value?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_configs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          alert_config_id: string | null
          alert_type: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean | null
          is_resolved: boolean | null
          message: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          title: string
          workspace_id: string
        }
        Insert: {
          alert_config_id?: string | null
          alert_type: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          is_resolved?: boolean | null
          message: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title: string
          workspace_id: string
        }
        Update: {
          alert_config_id?: string | null
          alert_type?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          is_resolved?: boolean | null
          message?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_alert_config_id_fkey"
            columns: ["alert_config_id"]
            isOneToOne: false
            referencedRelation: "alert_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_connections: {
        Row: {
          api_key_encrypted: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          platform: string
          sync_status: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          api_key_encrypted: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          platform: string
          sync_status?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          api_key_encrypted?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          platform?: string
          sync_status?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audience_segments: {
        Row: {
          company_size: string | null
          created_at: string
          geo: string | null
          id: string
          industry: string | null
          job_titles: string[] | null
          lead_count: number | null
          list_source: string | null
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          company_size?: string | null
          created_at?: string
          geo?: string | null
          id?: string
          industry?: string | null
          job_titles?: string[] | null
          lead_count?: number | null
          list_source?: string | null
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          company_size?: string | null
          created_at?: string
          geo?: string | null
          id?: string
          industry?: string | null
          job_titles?: string[] | null
          lead_count?: number | null
          list_source?: string | null
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audience_segments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_id: string
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_variants: {
        Row: {
          body_preview: string | null
          campaign_id: string
          created_at: string
          id: string
          is_control: boolean | null
          name: string
          subject_line: string | null
          variant_type: string
        }
        Insert: {
          body_preview?: string | null
          campaign_id: string
          created_at?: string
          id?: string
          is_control?: boolean | null
          name: string
          subject_line?: string | null
          variant_type: string
        }
        Update: {
          body_preview?: string | null
          campaign_id?: string
          created_at?: string
          id?: string
          is_control?: boolean | null
          name?: string
          subject_line?: string | null
          variant_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_variants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          id: string
          name: string
          platform: string
          platform_id: string
          status: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          platform: string
          platform_id: string
          status?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          platform?: string
          platform_id?: string
          status?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_metrics: {
        Row: {
          bounced_count: number | null
          campaign_id: string | null
          clicked_count: number | null
          created_at: string
          date: string
          delivered_count: number | null
          email_account_id: string | null
          id: string
          opened_count: number | null
          positive_reply_count: number | null
          replied_count: number | null
          segment_id: string | null
          sent_count: number | null
          spam_complaint_count: number | null
          unsubscribed_count: number | null
          updated_at: string
          variant_id: string | null
          workspace_id: string
        }
        Insert: {
          bounced_count?: number | null
          campaign_id?: string | null
          clicked_count?: number | null
          created_at?: string
          date: string
          delivered_count?: number | null
          email_account_id?: string | null
          id?: string
          opened_count?: number | null
          positive_reply_count?: number | null
          replied_count?: number | null
          segment_id?: string | null
          sent_count?: number | null
          spam_complaint_count?: number | null
          unsubscribed_count?: number | null
          updated_at?: string
          variant_id?: string | null
          workspace_id: string
        }
        Update: {
          bounced_count?: number | null
          campaign_id?: string | null
          clicked_count?: number | null
          created_at?: string
          date?: string
          delivered_count?: number | null
          email_account_id?: string | null
          id?: string
          opened_count?: number | null
          positive_reply_count?: number | null
          replied_count?: number | null
          segment_id?: string | null
          sent_count?: number | null
          spam_complaint_count?: number | null
          unsubscribed_count?: number | null
          updated_at?: string
          variant_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_metrics_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_metrics_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "audience_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_metrics_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "campaign_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          created_at: string
          daily_limit: number | null
          email_address: string
          health_score: number | null
          id: string
          is_active: boolean
          platform: string
          platform_id: string
          sender_name: string | null
          updated_at: string
          warmup_enabled: boolean | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          daily_limit?: number | null
          email_address: string
          health_score?: number | null
          id?: string
          is_active?: boolean
          platform: string
          platform_id: string
          sender_name?: string | null
          updated_at?: string
          warmup_enabled?: boolean | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          daily_limit?: number | null
          email_address?: string
          health_score?: number | null
          id?: string
          is_active?: boolean
          platform?: string
          platform_id?: string
          sender_name?: string | null
          updated_at?: string
          warmup_enabled?: boolean | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_variants: {
        Row: {
          created_at: string
          experiment_id: string
          id: string
          is_control: boolean | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          experiment_id: string
          id?: string
          is_control?: boolean | null
          variant_id: string
        }
        Update: {
          created_at?: string
          experiment_id?: string
          id?: string
          is_control?: boolean | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiment_variants_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_variants_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "campaign_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      experiments: {
        Row: {
          campaign_id: string | null
          created_at: string
          created_by: string
          ended_at: string | null
          guardrail_max_bounce_rate: number | null
          guardrail_max_unsub_rate: number | null
          hypothesis: string | null
          id: string
          min_runtime_days: number | null
          name: string
          primary_metric: string
          sample_size_target: number | null
          started_at: string | null
          status: string
          test_type: string
          updated_at: string
          winner_confidence: number | null
          winner_variant_id: string | null
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          created_by: string
          ended_at?: string | null
          guardrail_max_bounce_rate?: number | null
          guardrail_max_unsub_rate?: number | null
          hypothesis?: string | null
          id?: string
          min_runtime_days?: number | null
          name: string
          primary_metric?: string
          sample_size_target?: number | null
          started_at?: string | null
          status?: string
          test_type: string
          updated_at?: string
          winner_confidence?: number | null
          winner_variant_id?: string | null
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string
          ended_at?: string | null
          guardrail_max_bounce_rate?: number | null
          guardrail_max_unsub_rate?: number | null
          hypothesis?: string | null
          id?: string
          min_runtime_days?: number | null
          name?: string
          primary_metric?: string
          sample_size_target?: number | null
          started_at?: string | null
          status?: string
          test_type?: string
          updated_at?: string
          winner_confidence?: number | null
          winner_variant_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_winner_variant_id_fkey"
            columns: ["winner_variant_id"]
            isOneToOne: false
            referencedRelation: "campaign_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_events: {
        Row: {
          campaign_id: string | null
          created_at: string
          email_account_id: string | null
          event_type: string
          id: string
          lead_email: string | null
          metadata: Json | null
          occurred_at: string
          platform: string
          platform_event_id: string | null
          segment_id: string | null
          step_id: string | null
          variant_id: string | null
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          email_account_id?: string | null
          event_type: string
          id?: string
          lead_email?: string | null
          metadata?: Json | null
          occurred_at: string
          platform: string
          platform_event_id?: string | null
          segment_id?: string | null
          step_id?: string | null
          variant_id?: string | null
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          email_account_id?: string | null
          event_type?: string
          id?: string
          lead_email?: string | null
          metadata?: Json | null
          occurred_at?: string
          platform?: string
          platform_event_id?: string | null
          segment_id?: string | null
          step_id?: string | null
          variant_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_events_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_events_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "audience_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_events_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "sequence_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_events_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "campaign_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_entries: {
        Row: {
          context: string | null
          created_at: string
          created_by: string
          experiment_id: string | null
          id: string
          metrics: Json | null
          tags: string[] | null
          test_type: string
          title: string
          winning_pattern: string
          workspace_id: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          created_by: string
          experiment_id?: string | null
          id?: string
          metrics?: Json | null
          tags?: string[] | null
          test_type: string
          title: string
          winning_pattern: string
          workspace_id: string
        }
        Update: {
          context?: string | null
          created_at?: string
          created_by?: string
          experiment_id?: string | null
          id?: string
          metrics?: Json | null
          tags?: string[] | null
          test_type?: string
          title?: string
          winning_pattern?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_entries_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reply_classifications: {
        Row: {
          classification: string
          confidence_score: number
          created_at: string
          id: string
          is_human_verified: boolean | null
          message_event_id: string
          reply_content: string | null
          updated_at: string
          verified_by: string | null
        }
        Insert: {
          classification: string
          confidence_score: number
          created_at?: string
          id?: string
          is_human_verified?: boolean | null
          message_event_id: string
          reply_content?: string | null
          updated_at?: string
          verified_by?: string | null
        }
        Update: {
          classification?: string
          confidence_score?: number
          created_at?: string
          id?: string
          is_human_verified?: boolean | null
          message_event_id?: string
          reply_content?: string | null
          updated_at?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reply_classifications_message_event_id_fkey"
            columns: ["message_event_id"]
            isOneToOne: false
            referencedRelation: "message_events"
            referencedColumns: ["id"]
          },
        ]
      }
      sending_domains: {
        Row: {
          created_at: string
          dkim_valid: boolean | null
          dmarc_valid: boolean | null
          domain: string
          health_score: number | null
          id: string
          is_bulk_sender: boolean | null
          last_checked_at: string | null
          spf_valid: boolean | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          dkim_valid?: boolean | null
          dmarc_valid?: boolean | null
          domain: string
          health_score?: number | null
          id?: string
          is_bulk_sender?: boolean | null
          last_checked_at?: string | null
          spf_valid?: boolean | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          dkim_valid?: boolean | null
          dmarc_valid?: boolean | null
          domain?: string
          health_score?: number | null
          id?: string
          is_bulk_sender?: boolean | null
          last_checked_at?: string | null
          spf_valid?: boolean | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sending_domains_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_steps: {
        Row: {
          body_preview: string | null
          campaign_id: string
          created_at: string
          delay_days: number | null
          id: string
          step_number: number
          subject_line: string | null
          variant_id: string | null
        }
        Insert: {
          body_preview?: string | null
          campaign_id: string
          created_at?: string
          delay_days?: number | null
          id?: string
          step_number: number
          subject_line?: string | null
          variant_id?: string | null
        }
        Update: {
          body_preview?: string | null
          campaign_id?: string
          created_at?: string
          delay_days?: number | null
          id?: string
          step_number?: number
          subject_line?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequence_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_steps_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "campaign_variants"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "analyst" | "viewer"
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
      app_role: ["admin", "analyst", "viewer"],
    },
  },
} as const
