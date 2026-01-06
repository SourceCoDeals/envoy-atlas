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
          last_full_sync_at: string | null
          last_sync_at: string | null
          platform: string
          sync_progress: Json | null
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
          last_full_sync_at?: string | null
          last_sync_at?: string | null
          platform: string
          sync_progress?: Json | null
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
          last_full_sync_at?: string | null
          last_sync_at?: string | null
          platform?: string
          sync_progress?: Json | null
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
      campaign_variant_features: {
        Row: {
          body_avg_sentence_length: number | null
          body_bullet_point_count: number | null
          body_cta_position: string | null
          body_cta_strength: string | null
          body_cta_type: string | null
          body_has_calendar_link: boolean | null
          body_has_link: boolean | null
          body_has_proof: boolean | null
          body_link_count: number | null
          body_paragraph_count: number | null
          body_personalization_density: number | null
          body_personalization_types: string[] | null
          body_question_count: number | null
          body_reading_grade: number | null
          body_sentence_count: number | null
          body_tone: string | null
          body_value_proposition_count: number | null
          body_word_count: number | null
          extracted_at: string | null
          id: string
          subject_capitalization_style: string | null
          subject_char_count: number | null
          subject_first_word_type: string | null
          subject_has_emoji: boolean | null
          subject_has_number: boolean | null
          subject_is_question: boolean | null
          subject_personalization_count: number | null
          subject_personalization_position: number | null
          subject_spam_score: number | null
          subject_urgency_score: number | null
          subject_word_count: number | null
          updated_at: string | null
          variant_id: string
          workspace_id: string
        }
        Insert: {
          body_avg_sentence_length?: number | null
          body_bullet_point_count?: number | null
          body_cta_position?: string | null
          body_cta_strength?: string | null
          body_cta_type?: string | null
          body_has_calendar_link?: boolean | null
          body_has_link?: boolean | null
          body_has_proof?: boolean | null
          body_link_count?: number | null
          body_paragraph_count?: number | null
          body_personalization_density?: number | null
          body_personalization_types?: string[] | null
          body_question_count?: number | null
          body_reading_grade?: number | null
          body_sentence_count?: number | null
          body_tone?: string | null
          body_value_proposition_count?: number | null
          body_word_count?: number | null
          extracted_at?: string | null
          id?: string
          subject_capitalization_style?: string | null
          subject_char_count?: number | null
          subject_first_word_type?: string | null
          subject_has_emoji?: boolean | null
          subject_has_number?: boolean | null
          subject_is_question?: boolean | null
          subject_personalization_count?: number | null
          subject_personalization_position?: number | null
          subject_spam_score?: number | null
          subject_urgency_score?: number | null
          subject_word_count?: number | null
          updated_at?: string | null
          variant_id: string
          workspace_id: string
        }
        Update: {
          body_avg_sentence_length?: number | null
          body_bullet_point_count?: number | null
          body_cta_position?: string | null
          body_cta_strength?: string | null
          body_cta_type?: string | null
          body_has_calendar_link?: boolean | null
          body_has_link?: boolean | null
          body_has_proof?: boolean | null
          body_link_count?: number | null
          body_paragraph_count?: number | null
          body_personalization_density?: number | null
          body_personalization_types?: string[] | null
          body_question_count?: number | null
          body_reading_grade?: number | null
          body_sentence_count?: number | null
          body_tone?: string | null
          body_value_proposition_count?: number | null
          body_word_count?: number | null
          extracted_at?: string | null
          id?: string
          subject_capitalization_style?: string | null
          subject_char_count?: number | null
          subject_first_word_type?: string | null
          subject_has_emoji?: boolean | null
          subject_has_number?: boolean | null
          subject_is_question?: boolean | null
          subject_personalization_count?: number | null
          subject_personalization_position?: number | null
          subject_spam_score?: number | null
          subject_urgency_score?: number | null
          subject_word_count?: number | null
          updated_at?: string | null
          variant_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_variant_features_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "campaign_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_variant_features_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "copy_performance"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "campaign_variant_features_workspace_id_fkey"
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
          email_body: string | null
          id: string
          is_control: boolean | null
          name: string
          personalization_vars: Json | null
          platform_variant_id: string | null
          subject_line: string | null
          updated_at: string | null
          variant_type: string
          word_count: number | null
        }
        Insert: {
          body_preview?: string | null
          campaign_id: string
          created_at?: string
          email_body?: string | null
          id?: string
          is_control?: boolean | null
          name: string
          personalization_vars?: Json | null
          platform_variant_id?: string | null
          subject_line?: string | null
          updated_at?: string | null
          variant_type: string
          word_count?: number | null
        }
        Update: {
          body_preview?: string | null
          campaign_id?: string
          created_at?: string
          email_body?: string | null
          id?: string
          is_control?: boolean | null
          name?: string
          personalization_vars?: Json | null
          platform_variant_id?: string | null
          subject_line?: string | null
          updated_at?: string | null
          variant_type?: string
          word_count?: number | null
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
      copy_library: {
        Row: {
          ai_tags: string[] | null
          body_preview: string | null
          category: string
          created_at: string
          created_by: string
          email_body: string | null
          id: string
          is_template: boolean
          manual_tags: string[] | null
          notes: string | null
          performance_snapshot: Json | null
          personalization_vars: Json | null
          source_variant_id: string | null
          status: string
          subject_line: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ai_tags?: string[] | null
          body_preview?: string | null
          category?: string
          created_at?: string
          created_by: string
          email_body?: string | null
          id?: string
          is_template?: boolean
          manual_tags?: string[] | null
          notes?: string | null
          performance_snapshot?: Json | null
          personalization_vars?: Json | null
          source_variant_id?: string | null
          status?: string
          subject_line: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ai_tags?: string[] | null
          body_preview?: string | null
          category?: string
          created_at?: string
          created_by?: string
          email_body?: string | null
          id?: string
          is_template?: boolean
          manual_tags?: string[] | null
          notes?: string | null
          performance_snapshot?: Json | null
          personalization_vars?: Json | null
          source_variant_id?: string | null
          status?: string
          subject_line?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copy_library_source_variant_id_fkey"
            columns: ["source_variant_id"]
            isOneToOne: false
            referencedRelation: "campaign_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copy_library_source_variant_id_fkey"
            columns: ["source_variant_id"]
            isOneToOne: false
            referencedRelation: "copy_performance"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "copy_library_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_patterns: {
        Row: {
          confidence_interval_lower: number | null
          confidence_interval_upper: number | null
          confidence_level: string | null
          created_at: string | null
          id: string
          interaction_effects: Json | null
          is_validated: boolean | null
          last_computed: string | null
          meeting_rate: number | null
          meeting_rate_lift: number | null
          open_rate: number | null
          open_rate_lift: number | null
          p_value: number | null
          pattern_criteria: Json
          pattern_description: string | null
          pattern_name: string
          pattern_type: string
          positive_rate: number | null
          positive_rate_lift: number | null
          reply_rate: number | null
          reply_rate_lift: number | null
          sample_size: number
          segment_effects: Json | null
          step_effects: Json | null
          updated_at: string | null
          validated_at: string | null
          workspace_id: string
        }
        Insert: {
          confidence_interval_lower?: number | null
          confidence_interval_upper?: number | null
          confidence_level?: string | null
          created_at?: string | null
          id?: string
          interaction_effects?: Json | null
          is_validated?: boolean | null
          last_computed?: string | null
          meeting_rate?: number | null
          meeting_rate_lift?: number | null
          open_rate?: number | null
          open_rate_lift?: number | null
          p_value?: number | null
          pattern_criteria: Json
          pattern_description?: string | null
          pattern_name: string
          pattern_type: string
          positive_rate?: number | null
          positive_rate_lift?: number | null
          reply_rate?: number | null
          reply_rate_lift?: number | null
          sample_size?: number
          segment_effects?: Json | null
          step_effects?: Json | null
          updated_at?: string | null
          validated_at?: string | null
          workspace_id: string
        }
        Update: {
          confidence_interval_lower?: number | null
          confidence_interval_upper?: number | null
          confidence_level?: string | null
          created_at?: string | null
          id?: string
          interaction_effects?: Json | null
          is_validated?: boolean | null
          last_computed?: string | null
          meeting_rate?: number | null
          meeting_rate_lift?: number | null
          open_rate?: number | null
          open_rate_lift?: number | null
          p_value?: number | null
          pattern_criteria?: Json
          pattern_description?: string | null
          pattern_name?: string
          pattern_type?: string
          positive_rate?: number | null
          positive_rate_lift?: number | null
          reply_rate?: number | null
          reply_rate_lift?: number | null
          sample_size?: number
          segment_effects?: Json | null
          step_effects?: Json | null
          updated_at?: string | null
          validated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copy_patterns_workspace_id_fkey"
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
            foreignKeyName: "daily_metrics_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "copy_performance"
            referencedColumns: ["variant_id"]
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
      deal_clients: {
        Row: {
          contact_email: string | null
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          business_description: string | null
          client_id: string | null
          client_name: string | null
          created_at: string
          created_by: string
          ebitda: number | null
          geography: string | null
          id: string
          industry: string | null
          project_name: string
          revenue: number | null
          stage: string
          teaser_url: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          business_description?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          created_by: string
          ebitda?: number | null
          geography?: string | null
          id?: string
          industry?: string | null
          project_name: string
          revenue?: number | null
          stage?: string
          teaser_url?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          business_description?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string
          ebitda?: number | null
          geography?: string | null
          id?: string
          industry?: string | null
          project_name?: string
          revenue?: number | null
          stage?: string
          teaser_url?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "deal_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_workspace_id_fkey"
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
          {
            foreignKeyName: "experiment_variants_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "copy_performance"
            referencedColumns: ["variant_id"]
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
            foreignKeyName: "experiments_winner_variant_id_fkey"
            columns: ["winner_variant_id"]
            isOneToOne: false
            referencedRelation: "copy_performance"
            referencedColumns: ["variant_id"]
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
      hourly_metrics: {
        Row: {
          campaign_id: string | null
          clicked_count: number | null
          created_at: string
          date: string
          day_of_week: number
          hour: number
          id: string
          opened_count: number | null
          positive_reply_count: number | null
          replied_count: number | null
          sent_count: number | null
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          clicked_count?: number | null
          created_at?: string
          date: string
          day_of_week: number
          hour: number
          id?: string
          opened_count?: number | null
          positive_reply_count?: number | null
          replied_count?: number | null
          sent_count?: number | null
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          clicked_count?: number | null
          created_at?: string
          date?: string
          day_of_week?: number
          hour?: number
          id?: string
          opened_count?: number | null
          positive_reply_count?: number | null
          replied_count?: number | null
          sent_count?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hourly_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          campaign_id: string | null
          category: string | null
          company: string | null
          company_size: string | null
          created_at: string
          email: string
          email_domain: string | null
          email_type: string | null
          first_name: string | null
          id: string
          industry: string | null
          last_name: string | null
          lead_source: string | null
          linkedin_url: string | null
          location: string | null
          phone_number: string | null
          platform: string
          platform_lead_id: string | null
          status: string | null
          title: string | null
          updated_at: string
          website: string | null
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          category?: string | null
          company?: string | null
          company_size?: string | null
          created_at?: string
          email: string
          email_domain?: string | null
          email_type?: string | null
          first_name?: string | null
          id?: string
          industry?: string | null
          last_name?: string | null
          lead_source?: string | null
          linkedin_url?: string | null
          location?: string | null
          phone_number?: string | null
          platform: string
          platform_lead_id?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
          website?: string | null
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          category?: string | null
          company?: string | null
          company_size?: string | null
          created_at?: string
          email?: string
          email_domain?: string | null
          email_type?: string | null
          first_name?: string | null
          id?: string
          industry?: string | null
          last_name?: string | null
          lead_source?: string | null
          linkedin_url?: string | null
          location?: string | null
          phone_number?: string | null
          platform?: string
          platform_lead_id?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
          website?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
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
          lead_id: string | null
          metadata: Json | null
          occurred_at: string
          platform: string
          platform_event_id: string | null
          reply_content: string | null
          reply_sentiment: string | null
          segment_id: string | null
          sent_at: string | null
          sequence_step: number | null
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
          lead_id?: string | null
          metadata?: Json | null
          occurred_at: string
          platform: string
          platform_event_id?: string | null
          reply_content?: string | null
          reply_sentiment?: string | null
          segment_id?: string | null
          sent_at?: string | null
          sequence_step?: number | null
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
          lead_id?: string | null
          metadata?: Json | null
          occurred_at?: string
          platform?: string
          platform_event_id?: string | null
          reply_content?: string | null
          reply_sentiment?: string | null
          segment_id?: string | null
          sent_at?: string | null
          sequence_step?: number | null
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
            foreignKeyName: "message_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
            foreignKeyName: "message_events_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "copy_performance"
            referencedColumns: ["variant_id"]
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
            referencedRelation: "inbox_items"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "sequence_steps_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "copy_performance"
            referencedColumns: ["variant_id"]
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
      variant_decay_tracking: {
        Row: {
          created_at: string | null
          current_positive_rate: number | null
          current_reply_rate: number | null
          current_sample_size: number | null
          decay_detected_at: string | null
          decay_diagnosis: string | null
          decay_percentage: number | null
          decay_severity: string | null
          id: string
          initial_positive_rate: number | null
          initial_reply_rate: number | null
          initial_sample_size: number | null
          is_decaying: boolean | null
          is_statistically_significant: boolean | null
          last_computed: string | null
          p_value: number | null
          total_sends: number | null
          updated_at: string | null
          variant_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          current_positive_rate?: number | null
          current_reply_rate?: number | null
          current_sample_size?: number | null
          decay_detected_at?: string | null
          decay_diagnosis?: string | null
          decay_percentage?: number | null
          decay_severity?: string | null
          id?: string
          initial_positive_rate?: number | null
          initial_reply_rate?: number | null
          initial_sample_size?: number | null
          is_decaying?: boolean | null
          is_statistically_significant?: boolean | null
          last_computed?: string | null
          p_value?: number | null
          total_sends?: number | null
          updated_at?: string | null
          variant_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          current_positive_rate?: number | null
          current_reply_rate?: number | null
          current_sample_size?: number | null
          decay_detected_at?: string | null
          decay_diagnosis?: string | null
          decay_percentage?: number | null
          decay_severity?: string | null
          id?: string
          initial_positive_rate?: number | null
          initial_reply_rate?: number | null
          initial_sample_size?: number | null
          is_decaying?: boolean | null
          is_statistically_significant?: boolean | null
          last_computed?: string | null
          p_value?: number | null
          total_sends?: number | null
          updated_at?: string | null
          variant_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_decay_tracking_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "campaign_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_decay_tracking_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "copy_performance"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "variant_decay_tracking_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      audience_performance: {
        Row: {
          company_size: string | null
          contacted: number | null
          email_domain: string | null
          email_type: string | null
          industry: string | null
          opened: number | null
          positive_replies: number | null
          positive_reply_rate: number | null
          replied: number | null
          reply_rate: number | null
          title: string | null
          total_leads: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_performance: {
        Row: {
          body_preview: string | null
          campaign_id: string | null
          campaign_name: string | null
          click_rate: number | null
          email_body: string | null
          is_control: boolean | null
          open_rate: number | null
          personalization_vars: Json | null
          positive_reply_rate: number | null
          reply_rate: number | null
          subject_line: string | null
          total_clicked: number | null
          total_opened: number | null
          total_positive_replies: number | null
          total_replied: number | null
          total_sent: number | null
          variant_id: string | null
          variant_name: string | null
          variant_type: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_variants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_items: {
        Row: {
          campaign_id: string | null
          campaign_name: string | null
          company: string | null
          created_at: string | null
          email_domain: string | null
          email_type: string | null
          event_type: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          lead_email: string | null
          lead_id: string | null
          occurred_at: string | null
          reply_content: string | null
          reply_sentiment: string | null
          sequence_step: number | null
          subject_line: string | null
          title: string | null
          variant_name: string | null
          workspace_id: string | null
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
            foreignKeyName: "message_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
      time_performance: {
        Row: {
          day_of_week: number | null
          hour: number | null
          open_rate: number | null
          reply_rate: number | null
          total_opened: number | null
          total_positive: number | null
          total_replied: number | null
          total_sent: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hourly_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_workspace: {
        Args: { _name: string }
        Returns: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "workspaces"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
      is_first_workspace_member: {
        Args: { _workspace_id: string }
        Returns: boolean
      }
      is_workspace_admin: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
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
