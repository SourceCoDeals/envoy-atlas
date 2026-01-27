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
      call_activities: {
        Row: {
          call_summary: string | null
          callback_datetime: string | null
          callback_notes: string | null
          callback_scheduled: boolean | null
          caller_name: string | null
          caller_phone: string | null
          caller_user_id: string | null
          campaign_id: string | null
          company_id: string
          composite_score: number | null
          contact_id: string
          conversation_outcome: string | null
          counts_as_bad_data: boolean | null
          counts_as_connection: boolean | null
          counts_as_conversation: boolean | null
          counts_as_meeting: boolean | null
          created_at: string | null
          data_source_id: string | null
          disposition: string
          duration_seconds: number | null
          ended_at: string | null
          engagement_id: string
          external_id: string | null
          id: string
          is_dm_conversation: boolean | null
          nocodb_row_id: string | null
          notes: string | null
          objection_handling_score: number | null
          objections_list: string[] | null
          quality_of_conversation_score: number | null
          raw_data: Json | null
          recording_duration: number | null
          recording_url: string | null
          rep_id: string | null
          ring_duration: number | null
          scheduled_at: string | null
          script_adherence_score: number | null
          seller_interest_score: number | null
          source: string | null
          started_at: string | null
          synced_at: string | null
          talk_duration: number | null
          to_name: string | null
          to_phone: string
          transcription: string | null
          updated_at: string | null
          value_proposition_score: number | null
          voicemail_left: boolean | null
          voicemail_template: string | null
        }
        Insert: {
          call_summary?: string | null
          callback_datetime?: string | null
          callback_notes?: string | null
          callback_scheduled?: boolean | null
          caller_name?: string | null
          caller_phone?: string | null
          caller_user_id?: string | null
          campaign_id?: string | null
          company_id: string
          composite_score?: number | null
          contact_id: string
          conversation_outcome?: string | null
          counts_as_bad_data?: boolean | null
          counts_as_connection?: boolean | null
          counts_as_conversation?: boolean | null
          counts_as_meeting?: boolean | null
          created_at?: string | null
          data_source_id?: string | null
          disposition: string
          duration_seconds?: number | null
          ended_at?: string | null
          engagement_id: string
          external_id?: string | null
          id?: string
          is_dm_conversation?: boolean | null
          nocodb_row_id?: string | null
          notes?: string | null
          objection_handling_score?: number | null
          objections_list?: string[] | null
          quality_of_conversation_score?: number | null
          raw_data?: Json | null
          recording_duration?: number | null
          recording_url?: string | null
          rep_id?: string | null
          ring_duration?: number | null
          scheduled_at?: string | null
          script_adherence_score?: number | null
          seller_interest_score?: number | null
          source?: string | null
          started_at?: string | null
          synced_at?: string | null
          talk_duration?: number | null
          to_name?: string | null
          to_phone: string
          transcription?: string | null
          updated_at?: string | null
          value_proposition_score?: number | null
          voicemail_left?: boolean | null
          voicemail_template?: string | null
        }
        Update: {
          call_summary?: string | null
          callback_datetime?: string | null
          callback_notes?: string | null
          callback_scheduled?: boolean | null
          caller_name?: string | null
          caller_phone?: string | null
          caller_user_id?: string | null
          campaign_id?: string | null
          company_id?: string
          composite_score?: number | null
          contact_id?: string
          conversation_outcome?: string | null
          counts_as_bad_data?: boolean | null
          counts_as_connection?: boolean | null
          counts_as_conversation?: boolean | null
          counts_as_meeting?: boolean | null
          created_at?: string | null
          data_source_id?: string | null
          disposition?: string
          duration_seconds?: number | null
          ended_at?: string | null
          engagement_id?: string
          external_id?: string | null
          id?: string
          is_dm_conversation?: boolean | null
          nocodb_row_id?: string | null
          notes?: string | null
          objection_handling_score?: number | null
          objections_list?: string[] | null
          quality_of_conversation_score?: number | null
          raw_data?: Json | null
          recording_duration?: number | null
          recording_url?: string | null
          rep_id?: string | null
          ring_duration?: number | null
          scheduled_at?: string | null
          script_adherence_score?: number | null
          seller_interest_score?: number | null
          source?: string | null
          started_at?: string | null
          synced_at?: string | null
          talk_duration?: number | null
          to_name?: string | null
          to_phone?: string
          transcription?: string | null
          updated_at?: string | null
          value_proposition_score?: number | null
          voicemail_left?: boolean | null
          voicemail_template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_activities_caller_user_id_fkey"
            columns: ["caller_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_activities_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_activities_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_activities_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_activities_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
      call_ai_scores: {
        Row: {
          call_id: string | null
          closing_score: number | null
          created_at: string
          discovery_score: number | null
          id: string
          improvement_areas: string[] | null
          key_moments: Json | null
          objection_handling_score: number | null
          opening_score: number | null
          overall_score: number | null
        }
        Insert: {
          call_id?: string | null
          closing_score?: number | null
          created_at?: string
          discovery_score?: number | null
          id?: string
          improvement_areas?: string[] | null
          key_moments?: Json | null
          objection_handling_score?: number | null
          opening_score?: number | null
          overall_score?: number | null
        }
        Update: {
          call_id?: string | null
          closing_score?: number | null
          created_at?: string
          discovery_score?: number | null
          id?: string
          improvement_areas?: string[] | null
          key_moments?: Json | null
          objection_handling_score?: number | null
          opening_score?: number | null
          overall_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "call_ai_scores_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      call_objections: {
        Row: {
          call_id: string
          confidence: number | null
          created_at: string | null
          engagement_id: string
          extracted_by: string | null
          id: string
          objection_text: string
          objection_type: string
          resolution_attempted: string | null
          timestamp_in_call: number | null
          was_resolved: boolean | null
        }
        Insert: {
          call_id: string
          confidence?: number | null
          created_at?: string | null
          engagement_id: string
          extracted_by?: string | null
          id?: string
          objection_text: string
          objection_type: string
          resolution_attempted?: string | null
          timestamp_in_call?: number | null
          was_resolved?: boolean | null
        }
        Update: {
          call_id?: string
          confidence?: number | null
          created_at?: string | null
          engagement_id?: string
          extracted_by?: string | null
          id?: string
          objection_text?: string
          objection_type?: string
          resolution_attempted?: string | null
          timestamp_in_call?: number | null
          was_resolved?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "call_objections_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_objections_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      call_transcripts: {
        Row: {
          call_id: string | null
          created_at: string
          id: string
          transcript_json: Json | null
          transcript_text: string | null
        }
        Insert: {
          call_id?: string | null
          created_at?: string
          id?: string
          transcript_json?: Json | null
          transcript_text?: string | null
        }
        Update: {
          call_id?: string | null
          created_at?: string
          id?: string
          transcript_json?: Json | null
          transcript_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_transcripts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      calling_metrics_config: {
        Row: {
          call_duration_max_optimal: number | null
          call_duration_min_optimal: number | null
          call_duration_too_long: number | null
          call_duration_too_short: number | null
          client_id: string
          coaching_alert_objection_handling: number | null
          coaching_alert_overall_quality: number | null
          coaching_alert_question_adherence: number | null
          coaching_alert_script_adherence: number | null
          conversation_quality_thresholds: Json | null
          created_at: string | null
          hot_lead_interest_score: number | null
          hot_lead_requires_interest_yes: boolean | null
          id: string
          interest_values_negative: Json | null
          interest_values_positive: Json | null
          next_steps_clarity_thresholds: Json | null
          objection_handling_thresholds: Json | null
          objection_resolution_good_threshold: number | null
          objection_resolution_warning_threshold: number | null
          overall_quality_thresholds: Json | null
          personal_insights_thresholds: Json | null
          question_adherence_thresholds: Json | null
          question_coverage_good_threshold: number | null
          question_coverage_total: number | null
          question_coverage_warning_threshold: number | null
          rapport_building_thresholds: Json | null
          scores_decimal_places: number | null
          script_adherence_thresholds: Json | null
          seller_interest_thresholds: Json | null
          show_score_justifications: boolean | null
          top_calls_min_score: number | null
          updated_at: string | null
          valuation_discussion_thresholds: Json | null
          value_proposition_thresholds: Json | null
          worst_calls_max_score: number | null
        }
        Insert: {
          call_duration_max_optimal?: number | null
          call_duration_min_optimal?: number | null
          call_duration_too_long?: number | null
          call_duration_too_short?: number | null
          client_id: string
          coaching_alert_objection_handling?: number | null
          coaching_alert_overall_quality?: number | null
          coaching_alert_question_adherence?: number | null
          coaching_alert_script_adherence?: number | null
          conversation_quality_thresholds?: Json | null
          created_at?: string | null
          hot_lead_interest_score?: number | null
          hot_lead_requires_interest_yes?: boolean | null
          id?: string
          interest_values_negative?: Json | null
          interest_values_positive?: Json | null
          next_steps_clarity_thresholds?: Json | null
          objection_handling_thresholds?: Json | null
          objection_resolution_good_threshold?: number | null
          objection_resolution_warning_threshold?: number | null
          overall_quality_thresholds?: Json | null
          personal_insights_thresholds?: Json | null
          question_adherence_thresholds?: Json | null
          question_coverage_good_threshold?: number | null
          question_coverage_total?: number | null
          question_coverage_warning_threshold?: number | null
          rapport_building_thresholds?: Json | null
          scores_decimal_places?: number | null
          script_adherence_thresholds?: Json | null
          seller_interest_thresholds?: Json | null
          show_score_justifications?: boolean | null
          top_calls_min_score?: number | null
          updated_at?: string | null
          valuation_discussion_thresholds?: Json | null
          value_proposition_thresholds?: Json | null
          worst_calls_max_score?: number | null
        }
        Update: {
          call_duration_max_optimal?: number | null
          call_duration_min_optimal?: number | null
          call_duration_too_long?: number | null
          call_duration_too_short?: number | null
          client_id?: string
          coaching_alert_objection_handling?: number | null
          coaching_alert_overall_quality?: number | null
          coaching_alert_question_adherence?: number | null
          coaching_alert_script_adherence?: number | null
          conversation_quality_thresholds?: Json | null
          created_at?: string | null
          hot_lead_interest_score?: number | null
          hot_lead_requires_interest_yes?: boolean | null
          id?: string
          interest_values_negative?: Json | null
          interest_values_positive?: Json | null
          next_steps_clarity_thresholds?: Json | null
          objection_handling_thresholds?: Json | null
          objection_resolution_good_threshold?: number | null
          objection_resolution_warning_threshold?: number | null
          overall_quality_thresholds?: Json | null
          personal_insights_thresholds?: Json | null
          question_adherence_thresholds?: Json | null
          question_coverage_good_threshold?: number | null
          question_coverage_total?: number | null
          question_coverage_warning_threshold?: number | null
          rapport_building_thresholds?: Json | null
          scores_decimal_places?: number | null
          script_adherence_thresholds?: Json | null
          seller_interest_thresholds?: Json | null
          show_score_justifications?: boolean | null
          top_calls_min_score?: number | null
          updated_at?: string | null
          valuation_discussion_thresholds?: Json | null
          value_proposition_thresholds?: Json | null
          worst_calls_max_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "calling_metrics_config_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_alerts: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          is_resolved: boolean | null
          message: string
          resolved_at: string | null
          severity: string
          type: string
          updated_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          is_resolved?: boolean | null
          message: string
          resolved_at?: string | null
          severity?: string
          type: string
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          is_resolved?: boolean | null
          message?: string
          resolved_at?: string | null
          severity?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_alerts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_email_accounts: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          email_account_id: string | null
          id: string
          is_active: boolean | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          email_account_id?: string | null
          id?: string
          is_active?: boolean | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          email_account_id?: string | null
          id?: string
          is_active?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_email_accounts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_email_accounts_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_platform_mappings: {
        Row: {
          campaign_id: string
          created_at: string | null
          engagement_id: string
          external_campaign_id: string
          external_campaign_name: string | null
          id: string
          last_synced_at: string | null
          platform: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          engagement_id: string
          external_campaign_id: string
          external_campaign_name?: string | null
          id?: string
          last_synced_at?: string | null
          platform: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          engagement_id?: string
          external_campaign_id?: string
          external_campaign_name?: string | null
          id?: string
          last_synced_at?: string | null
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_platform_mappings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_platform_mappings_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_variant_features: {
        Row: {
          analyzed_at: string | null
          body_bullet_count: number | null
          body_cta_position: string | null
          body_cta_strength: string | null
          body_cta_type: string | null
          body_has_bullets: boolean | null
          body_has_calendar_link: boolean | null
          body_has_personalization: boolean | null
          body_length: number | null
          body_link_count: number | null
          body_paragraph_count: number | null
          body_personalization_count: number | null
          body_question_count: number | null
          body_reading_grade: number | null
          body_sentence_count: number | null
          body_value_proposition_count: number | null
          body_word_count: number | null
          body_you_i_ratio: number | null
          created_at: string | null
          engagement_id: string | null
          has_attachments: boolean | null
          has_links: boolean | null
          hook_type: string | null
          id: string
          opening_line_text: string | null
          opening_line_type: string | null
          personalization_level: string | null
          subject_capitalization: string | null
          subject_first_word_type: string | null
          subject_format: string | null
          subject_has_emoji: boolean | null
          subject_has_number: boolean | null
          subject_has_personalization: boolean | null
          subject_length: number | null
          subject_personalization_type: string | null
          subject_punctuation: string | null
          subject_spam_word_count: number | null
          subject_urgency_score: number | null
          subject_word_count: number | null
          tone: string | null
          updated_at: string | null
          variant_id: string
          you_we_ratio: number | null
        }
        Insert: {
          analyzed_at?: string | null
          body_bullet_count?: number | null
          body_cta_position?: string | null
          body_cta_strength?: string | null
          body_cta_type?: string | null
          body_has_bullets?: boolean | null
          body_has_calendar_link?: boolean | null
          body_has_personalization?: boolean | null
          body_length?: number | null
          body_link_count?: number | null
          body_paragraph_count?: number | null
          body_personalization_count?: number | null
          body_question_count?: number | null
          body_reading_grade?: number | null
          body_sentence_count?: number | null
          body_value_proposition_count?: number | null
          body_word_count?: number | null
          body_you_i_ratio?: number | null
          created_at?: string | null
          engagement_id?: string | null
          has_attachments?: boolean | null
          has_links?: boolean | null
          hook_type?: string | null
          id?: string
          opening_line_text?: string | null
          opening_line_type?: string | null
          personalization_level?: string | null
          subject_capitalization?: string | null
          subject_first_word_type?: string | null
          subject_format?: string | null
          subject_has_emoji?: boolean | null
          subject_has_number?: boolean | null
          subject_has_personalization?: boolean | null
          subject_length?: number | null
          subject_personalization_type?: string | null
          subject_punctuation?: string | null
          subject_spam_word_count?: number | null
          subject_urgency_score?: number | null
          subject_word_count?: number | null
          tone?: string | null
          updated_at?: string | null
          variant_id: string
          you_we_ratio?: number | null
        }
        Update: {
          analyzed_at?: string | null
          body_bullet_count?: number | null
          body_cta_position?: string | null
          body_cta_strength?: string | null
          body_cta_type?: string | null
          body_has_bullets?: boolean | null
          body_has_calendar_link?: boolean | null
          body_has_personalization?: boolean | null
          body_length?: number | null
          body_link_count?: number | null
          body_paragraph_count?: number | null
          body_personalization_count?: number | null
          body_question_count?: number | null
          body_reading_grade?: number | null
          body_sentence_count?: number | null
          body_value_proposition_count?: number | null
          body_word_count?: number | null
          body_you_i_ratio?: number | null
          created_at?: string | null
          engagement_id?: string | null
          has_attachments?: boolean | null
          has_links?: boolean | null
          hook_type?: string | null
          id?: string
          opening_line_text?: string | null
          opening_line_type?: string | null
          personalization_level?: string | null
          subject_capitalization?: string | null
          subject_first_word_type?: string | null
          subject_format?: string | null
          subject_has_emoji?: boolean | null
          subject_has_number?: boolean | null
          subject_has_personalization?: boolean | null
          subject_length?: number | null
          subject_personalization_type?: string | null
          subject_punctuation?: string | null
          subject_spam_word_count?: number | null
          subject_urgency_score?: number | null
          subject_word_count?: number | null
          tone?: string | null
          updated_at?: string | null
          variant_id?: string
          you_we_ratio?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_variant_features_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
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
        ]
      }
      campaign_variants: {
        Row: {
          body_html: string | null
          body_plain: string | null
          body_preview: string | null
          bounce_rate: number | null
          campaign_id: string
          click_rate: number | null
          confidence_level: string | null
          created_at: string | null
          data_source_id: string | null
          delay_config: Json | null
          delay_days: number | null
          delivery_rate: number | null
          external_id: string | null
          first_sent_at: string | null
          id: string
          is_control: boolean | null
          last_sent_at: string | null
          margin_of_error: number | null
          not_interested_replies: number | null
          open_rate: number | null
          personalization_vars: Json | null
          positive_replies: number | null
          positive_reply_rate: number | null
          reply_rate: number | null
          sample_size_sufficient: boolean | null
          send_as_reply: boolean | null
          sequence_id: string | null
          status: string | null
          step_number: number | null
          subject_line: string
          timing_replies: number | null
          total_bounced: number | null
          total_clicked: number | null
          total_delivered: number | null
          total_opened: number | null
          total_replied: number | null
          total_sent: number | null
          total_unsubscribed: number | null
          updated_at: string | null
          variant_label: string | null
        }
        Insert: {
          body_html?: string | null
          body_plain?: string | null
          body_preview?: string | null
          bounce_rate?: number | null
          campaign_id: string
          click_rate?: number | null
          confidence_level?: string | null
          created_at?: string | null
          data_source_id?: string | null
          delay_config?: Json | null
          delay_days?: number | null
          delivery_rate?: number | null
          external_id?: string | null
          first_sent_at?: string | null
          id?: string
          is_control?: boolean | null
          last_sent_at?: string | null
          margin_of_error?: number | null
          not_interested_replies?: number | null
          open_rate?: number | null
          personalization_vars?: Json | null
          positive_replies?: number | null
          positive_reply_rate?: number | null
          reply_rate?: number | null
          sample_size_sufficient?: boolean | null
          send_as_reply?: boolean | null
          sequence_id?: string | null
          status?: string | null
          step_number?: number | null
          subject_line: string
          timing_replies?: number | null
          total_bounced?: number | null
          total_clicked?: number | null
          total_delivered?: number | null
          total_opened?: number | null
          total_replied?: number | null
          total_sent?: number | null
          total_unsubscribed?: number | null
          updated_at?: string | null
          variant_label?: string | null
        }
        Update: {
          body_html?: string | null
          body_plain?: string | null
          body_preview?: string | null
          bounce_rate?: number | null
          campaign_id?: string
          click_rate?: number | null
          confidence_level?: string | null
          created_at?: string | null
          data_source_id?: string | null
          delay_config?: Json | null
          delay_days?: number | null
          delivery_rate?: number | null
          external_id?: string | null
          first_sent_at?: string | null
          id?: string
          is_control?: boolean | null
          last_sent_at?: string | null
          margin_of_error?: number | null
          not_interested_replies?: number | null
          open_rate?: number | null
          personalization_vars?: Json | null
          positive_replies?: number | null
          positive_reply_rate?: number | null
          reply_rate?: number | null
          sample_size_sufficient?: boolean | null
          send_as_reply?: boolean | null
          sequence_id?: string | null
          status?: string | null
          step_number?: number | null
          subject_line?: string
          timing_replies?: number | null
          total_bounced?: number | null
          total_clicked?: number | null
          total_delivered?: number | null
          total_opened?: number | null
          total_replied?: number | null
          total_sent?: number | null
          total_unsubscribed?: number | null
          updated_at?: string | null
          variant_label?: string | null
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
            foreignKeyName: "campaign_variants_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_variants_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          bounce_rate: number | null
          campaign_type: string
          completed_at: string | null
          created_at: string | null
          data_source_id: string | null
          engagement_id: string
          external_id: string | null
          external_url: string | null
          id: string
          is_archived: boolean | null
          last_synced_at: string | null
          max_leads_per_day: number | null
          metrics_hash: string | null
          min_time_between_emails: number | null
          name: string
          open_rate: number | null
          owner_id: string | null
          positive_rate: number | null
          positive_replies: number | null
          quality_score: number | null
          quality_tier: string | null
          reply_rate: number | null
          schedule_config: Json | null
          sending_limits: Json | null
          settings: Json | null
          started_at: string | null
          status: string | null
          stop_lead_settings: Json | null
          team_id: string | null
          timezone: string | null
          total_bounced: number | null
          total_delivered: number | null
          total_meetings: number | null
          total_opened: number | null
          total_replied: number | null
          total_sent: number | null
          track_settings: Json | null
          updated_at: string | null
        }
        Insert: {
          bounce_rate?: number | null
          campaign_type: string
          completed_at?: string | null
          created_at?: string | null
          data_source_id?: string | null
          engagement_id: string
          external_id?: string | null
          external_url?: string | null
          id?: string
          is_archived?: boolean | null
          last_synced_at?: string | null
          max_leads_per_day?: number | null
          metrics_hash?: string | null
          min_time_between_emails?: number | null
          name: string
          open_rate?: number | null
          owner_id?: string | null
          positive_rate?: number | null
          positive_replies?: number | null
          quality_score?: number | null
          quality_tier?: string | null
          reply_rate?: number | null
          schedule_config?: Json | null
          sending_limits?: Json | null
          settings?: Json | null
          started_at?: string | null
          status?: string | null
          stop_lead_settings?: Json | null
          team_id?: string | null
          timezone?: string | null
          total_bounced?: number | null
          total_delivered?: number | null
          total_meetings?: number | null
          total_opened?: number | null
          total_replied?: number | null
          total_sent?: number | null
          track_settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          bounce_rate?: number | null
          campaign_type?: string
          completed_at?: string | null
          created_at?: string | null
          data_source_id?: string | null
          engagement_id?: string
          external_id?: string | null
          external_url?: string | null
          id?: string
          is_archived?: boolean | null
          last_synced_at?: string | null
          max_leads_per_day?: number | null
          metrics_hash?: string | null
          min_time_between_emails?: number | null
          name?: string
          open_rate?: number | null
          owner_id?: string | null
          positive_rate?: number | null
          positive_replies?: number | null
          quality_score?: number | null
          quality_tier?: string | null
          reply_rate?: number | null
          schedule_config?: Json | null
          sending_limits?: Json | null
          settings?: Json | null
          started_at?: string | null
          status?: string | null
          stop_lead_settings?: Json | null
          team_id?: string | null
          timezone?: string | null
          total_bounced?: number | null
          total_delivered?: number | null
          total_meetings?: number | null
          total_opened?: number | null
          total_replied?: number | null
          total_sent?: number | null
          track_settings?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      client_members: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          role: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          role?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          client_type: string
          contact_email: string | null
          created_at: string | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          settings: Json | null
          slug: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          client_type?: string
          contact_email?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          settings?: Json | null
          slug: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          client_type?: string
          contact_email?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          settings?: Json | null
          slug?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cold_calls: {
        Row: {
          analyst: string | null
          call_duration_sec: number | null
          call_recording_url: string | null
          call_summary: string | null
          call_transcript: string | null
          called_date: string | null
          called_date_time: string | null
          campaign_id: string | null
          category: string | null
          client_id: string
          composite_score: number | null
          conversation_quality_reasoning: string | null
          created_at: string
          decision_maker_identified_score: number | null
          decision_maker_reasoning: string | null
          direction: string | null
          engagement_id: string | null
          engagement_score: number | null
          enhanced_score: number | null
          flag_reason: string | null
          flagged_for_review: boolean | null
          follow_up_date: string | null
          from_name: string | null
          from_number: string | null
          gatekeeper_handling_score: number | null
          id: string
          interest_rating_reasoning: string | null
          is_bad_data: boolean | null
          is_connection: boolean | null
          is_first_attempt_dm: boolean | null
          is_meeting: boolean | null
          is_voicemail: boolean | null
          key_concerns: string[] | null
          next_step_clarity_score: number | null
          nocodb_created_at: string | null
          nocodb_id: number | null
          nocodb_updated_at: string | null
          normalized_category: string | null
          not_interested_reason: string | null
          objection_handling_reasoning: string | null
          objection_handling_score: number | null
          objections: string | null
          opening_type: string | null
          primary_opportunity: string | null
          quality_of_conversation_score: number | null
          rapport_building_score: number | null
          referral_rate_reasoning: string | null
          referral_rate_score: number | null
          rep_notes: string | null
          resolution_rate: number | null
          resolution_rate_reasoning: string | null
          salesforce_url: string | null
          score_breakdown: Json | null
          script_adherence_reasoning: string | null
          script_adherence_score: number | null
          seller_interest_score: number | null
          target_pain_points: string | null
          to_company: string | null
          to_email: string | null
          to_name: string | null
          to_number: string | null
          updated_at: string
          value_clarity_reasoning: string | null
          value_proposition_score: number | null
        }
        Insert: {
          analyst?: string | null
          call_duration_sec?: number | null
          call_recording_url?: string | null
          call_summary?: string | null
          call_transcript?: string | null
          called_date?: string | null
          called_date_time?: string | null
          campaign_id?: string | null
          category?: string | null
          client_id: string
          composite_score?: number | null
          conversation_quality_reasoning?: string | null
          created_at?: string
          decision_maker_identified_score?: number | null
          decision_maker_reasoning?: string | null
          direction?: string | null
          engagement_id?: string | null
          engagement_score?: number | null
          enhanced_score?: number | null
          flag_reason?: string | null
          flagged_for_review?: boolean | null
          follow_up_date?: string | null
          from_name?: string | null
          from_number?: string | null
          gatekeeper_handling_score?: number | null
          id?: string
          interest_rating_reasoning?: string | null
          is_bad_data?: boolean | null
          is_connection?: boolean | null
          is_first_attempt_dm?: boolean | null
          is_meeting?: boolean | null
          is_voicemail?: boolean | null
          key_concerns?: string[] | null
          next_step_clarity_score?: number | null
          nocodb_created_at?: string | null
          nocodb_id?: number | null
          nocodb_updated_at?: string | null
          normalized_category?: string | null
          not_interested_reason?: string | null
          objection_handling_reasoning?: string | null
          objection_handling_score?: number | null
          objections?: string | null
          opening_type?: string | null
          primary_opportunity?: string | null
          quality_of_conversation_score?: number | null
          rapport_building_score?: number | null
          referral_rate_reasoning?: string | null
          referral_rate_score?: number | null
          rep_notes?: string | null
          resolution_rate?: number | null
          resolution_rate_reasoning?: string | null
          salesforce_url?: string | null
          score_breakdown?: Json | null
          script_adherence_reasoning?: string | null
          script_adherence_score?: number | null
          seller_interest_score?: number | null
          target_pain_points?: string | null
          to_company?: string | null
          to_email?: string | null
          to_name?: string | null
          to_number?: string | null
          updated_at?: string
          value_clarity_reasoning?: string | null
          value_proposition_score?: number | null
        }
        Update: {
          analyst?: string | null
          call_duration_sec?: number | null
          call_recording_url?: string | null
          call_summary?: string | null
          call_transcript?: string | null
          called_date?: string | null
          called_date_time?: string | null
          campaign_id?: string | null
          category?: string | null
          client_id?: string
          composite_score?: number | null
          conversation_quality_reasoning?: string | null
          created_at?: string
          decision_maker_identified_score?: number | null
          decision_maker_reasoning?: string | null
          direction?: string | null
          engagement_id?: string | null
          engagement_score?: number | null
          enhanced_score?: number | null
          flag_reason?: string | null
          flagged_for_review?: boolean | null
          follow_up_date?: string | null
          from_name?: string | null
          from_number?: string | null
          gatekeeper_handling_score?: number | null
          id?: string
          interest_rating_reasoning?: string | null
          is_bad_data?: boolean | null
          is_connection?: boolean | null
          is_first_attempt_dm?: boolean | null
          is_meeting?: boolean | null
          is_voicemail?: boolean | null
          key_concerns?: string[] | null
          next_step_clarity_score?: number | null
          nocodb_created_at?: string | null
          nocodb_id?: number | null
          nocodb_updated_at?: string | null
          normalized_category?: string | null
          not_interested_reason?: string | null
          objection_handling_reasoning?: string | null
          objection_handling_score?: number | null
          objections?: string | null
          opening_type?: string | null
          primary_opportunity?: string | null
          quality_of_conversation_score?: number | null
          rapport_building_score?: number | null
          referral_rate_reasoning?: string | null
          referral_rate_score?: number | null
          rep_notes?: string | null
          resolution_rate?: number | null
          resolution_rate_reasoning?: string | null
          salesforce_url?: string | null
          score_breakdown?: Json | null
          script_adherence_reasoning?: string | null
          script_adherence_score?: number | null
          seller_interest_score?: number | null
          target_pain_points?: string | null
          to_company?: string | null
          to_email?: string | null
          to_name?: string | null
          to_number?: string | null
          updated_at?: string
          value_clarity_reasoning?: string | null
          value_proposition_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cold_calls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cold_calls_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cold_calls_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_postal: string | null
          address_state: string | null
          address_street: string | null
          call_touches: number | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          domain: string | null
          email_touches: number | null
          employee_count: number | null
          employee_range: string | null
          engagement_id: string
          first_response_at: string | null
          id: string
          industry: string | null
          last_touch_at: string | null
          last_touch_type: string | null
          linkedin_url: string | null
          name: string
          response_type: string | null
          revenue: number | null
          revenue_range: string | null
          source: string | null
          status: string | null
          sub_industry: string | null
          total_touches: number | null
          updated_at: string | null
          website: string | null
          year_founded: number | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_postal?: string | null
          address_state?: string | null
          address_street?: string | null
          call_touches?: number | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          domain?: string | null
          email_touches?: number | null
          employee_count?: number | null
          employee_range?: string | null
          engagement_id: string
          first_response_at?: string | null
          id?: string
          industry?: string | null
          last_touch_at?: string | null
          last_touch_type?: string | null
          linkedin_url?: string | null
          name: string
          response_type?: string | null
          revenue?: number | null
          revenue_range?: string | null
          source?: string | null
          status?: string | null
          sub_industry?: string | null
          total_touches?: number | null
          updated_at?: string | null
          website?: string | null
          year_founded?: number | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_postal?: string | null
          address_state?: string | null
          address_street?: string | null
          call_touches?: number | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          domain?: string | null
          email_touches?: number | null
          employee_count?: number | null
          employee_range?: string | null
          engagement_id?: string
          first_response_at?: string | null
          id?: string
          industry?: string | null
          last_touch_at?: string | null
          last_touch_type?: string | null
          linkedin_url?: string | null
          name?: string
          response_type?: string | null
          revenue?: number | null
          revenue_range?: string | null
          source?: string | null
          status?: string | null
          sub_industry?: string | null
          total_touches?: number | null
          updated_at?: string | null
          website?: string | null
          year_founded?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_notes: {
        Row: {
          contact_id: string
          created_at: string | null
          created_by: string | null
          engagement_id: string
          id: string
          note_text: string
          note_type: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          created_by?: string | null
          engagement_id: string
          id?: string
          note_text: string
          note_type?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          created_by?: string | null
          engagement_id?: string
          id?: string
          note_text?: string
          note_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_notes_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          best_time_to_call: string | null
          bounce_type: string | null
          bounced_at: string | null
          campaign_lead_map_id: string | null
          category_id: string | null
          click_count: number | null
          company_id: string
          company_size_category: string | null
          created_at: string | null
          current_step: number | null
          deleted_at: string | null
          department: string | null
          do_not_call: boolean | null
          do_not_contact: boolean | null
          do_not_email: boolean | null
          email: string | null
          email_status: string | null
          engagement_id: string
          enrolled_at: string | null
          external_lead_id: string | null
          finish_reason: string | null
          first_name: string | null
          id: string
          is_decision_maker: boolean | null
          is_interested: boolean | null
          is_primary: boolean | null
          is_unsubscribed: boolean | null
          last_activity_at: string | null
          last_contacted_at: string | null
          last_name: string | null
          last_responded_at: string | null
          linkedin_url: string | null
          mobile: string | null
          open_count: number | null
          phone: string | null
          phone_status: string | null
          reply_count: number | null
          seniority_level: string | null
          sequence_status: string | null
          source: string | null
          timezone: string | null
          title: string | null
          title_level: string | null
          total_calls: number | null
          total_conversations: number | null
          total_emails_opened: number | null
          total_emails_replied: number | null
          total_emails_sent: number | null
          unsubscribed_at: string | null
          updated_at: string | null
        }
        Insert: {
          best_time_to_call?: string | null
          bounce_type?: string | null
          bounced_at?: string | null
          campaign_lead_map_id?: string | null
          category_id?: string | null
          click_count?: number | null
          company_id: string
          company_size_category?: string | null
          created_at?: string | null
          current_step?: number | null
          deleted_at?: string | null
          department?: string | null
          do_not_call?: boolean | null
          do_not_contact?: boolean | null
          do_not_email?: boolean | null
          email?: string | null
          email_status?: string | null
          engagement_id: string
          enrolled_at?: string | null
          external_lead_id?: string | null
          finish_reason?: string | null
          first_name?: string | null
          id?: string
          is_decision_maker?: boolean | null
          is_interested?: boolean | null
          is_primary?: boolean | null
          is_unsubscribed?: boolean | null
          last_activity_at?: string | null
          last_contacted_at?: string | null
          last_name?: string | null
          last_responded_at?: string | null
          linkedin_url?: string | null
          mobile?: string | null
          open_count?: number | null
          phone?: string | null
          phone_status?: string | null
          reply_count?: number | null
          seniority_level?: string | null
          sequence_status?: string | null
          source?: string | null
          timezone?: string | null
          title?: string | null
          title_level?: string | null
          total_calls?: number | null
          total_conversations?: number | null
          total_emails_opened?: number | null
          total_emails_replied?: number | null
          total_emails_sent?: number | null
          unsubscribed_at?: string | null
          updated_at?: string | null
        }
        Update: {
          best_time_to_call?: string | null
          bounce_type?: string | null
          bounced_at?: string | null
          campaign_lead_map_id?: string | null
          category_id?: string | null
          click_count?: number | null
          company_id?: string
          company_size_category?: string | null
          created_at?: string | null
          current_step?: number | null
          deleted_at?: string | null
          department?: string | null
          do_not_call?: boolean | null
          do_not_contact?: boolean | null
          do_not_email?: boolean | null
          email?: string | null
          email_status?: string | null
          engagement_id?: string
          enrolled_at?: string | null
          external_lead_id?: string | null
          finish_reason?: string | null
          first_name?: string | null
          id?: string
          is_decision_maker?: boolean | null
          is_interested?: boolean | null
          is_primary?: boolean | null
          is_unsubscribed?: boolean | null
          last_activity_at?: string | null
          last_contacted_at?: string | null
          last_name?: string | null
          last_responded_at?: string | null
          linkedin_url?: string | null
          mobile?: string | null
          open_count?: number | null
          phone?: string | null
          phone_status?: string | null
          reply_count?: number | null
          seniority_level?: string | null
          sequence_status?: string | null
          source?: string | null
          timezone?: string | null
          title?: string | null
          title_level?: string | null
          total_calls?: number | null
          total_conversations?: number | null
          total_emails_opened?: number | null
          total_emails_replied?: number | null
          total_emails_sent?: number | null
          unsubscribed_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "lead_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_library: {
        Row: {
          body_html: string | null
          body_plain: string | null
          category: string | null
          created_at: string | null
          created_by: string | null
          engagement_id: string | null
          id: string
          is_template: boolean | null
          notes: string | null
          performance_snapshot: Json | null
          positive_rate: number | null
          reply_rate: number | null
          subject_line: string
          tags: string[] | null
          title: string
          total_replied: number | null
          total_sent: number | null
          updated_at: string | null
          variant_id: string | null
        }
        Insert: {
          body_html?: string | null
          body_plain?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          engagement_id?: string | null
          id?: string
          is_template?: boolean | null
          notes?: string | null
          performance_snapshot?: Json | null
          positive_rate?: number | null
          reply_rate?: number | null
          subject_line: string
          tags?: string[] | null
          title: string
          total_replied?: number | null
          total_sent?: number | null
          updated_at?: string | null
          variant_id?: string | null
        }
        Update: {
          body_html?: string | null
          body_plain?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          engagement_id?: string | null
          id?: string
          is_template?: boolean | null
          notes?: string | null
          performance_snapshot?: Json | null
          positive_rate?: number | null
          reply_rate?: number | null
          subject_line?: string
          tags?: string[] | null
          title?: string
          total_replied?: number | null
          total_sent?: number | null
          updated_at?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "copy_library_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copy_library_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copy_library_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "campaign_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copy_library_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "copy_performance"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      copy_patterns: {
        Row: {
          avg_reply_rate: number | null
          baseline_reply_rate: number | null
          computed_at: string | null
          created_at: string | null
          engagement_id: string | null
          id: string
          is_significant: boolean | null
          lift_vs_baseline: number | null
          p_value: number | null
          pattern_type: string
          pattern_value: string
          reply_rate_ci_lower: number | null
          reply_rate_ci_upper: number | null
          total_replied: number | null
          total_sent: number | null
          total_variants: number | null
        }
        Insert: {
          avg_reply_rate?: number | null
          baseline_reply_rate?: number | null
          computed_at?: string | null
          created_at?: string | null
          engagement_id?: string | null
          id?: string
          is_significant?: boolean | null
          lift_vs_baseline?: number | null
          p_value?: number | null
          pattern_type: string
          pattern_value: string
          reply_rate_ci_lower?: number | null
          reply_rate_ci_upper?: number | null
          total_replied?: number | null
          total_sent?: number | null
          total_variants?: number | null
        }
        Update: {
          avg_reply_rate?: number | null
          baseline_reply_rate?: number | null
          computed_at?: string | null
          created_at?: string | null
          engagement_id?: string | null
          id?: string
          is_significant?: boolean | null
          lift_vs_baseline?: number | null
          p_value?: number | null
          pattern_type?: string
          pattern_value?: string
          reply_rate_ci_lower?: number | null
          reply_rate_ci_upper?: number | null
          total_replied?: number | null
          total_sent?: number | null
          total_variants?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "copy_patterns_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_calling_metrics: {
        Row: {
          avg_call_duration_seconds: number | null
          avg_composite_score: number | null
          avg_interest_score: number | null
          avg_quality_score: number | null
          caller_name: string | null
          connect_rate: number | null
          connections: number | null
          conversation_rate: number | null
          conversations: number | null
          created_at: string | null
          date: string
          dm_conversations: number | null
          engagement_id: string | null
          id: string
          meeting_rate: number | null
          meetings_booked: number | null
          total_dials: number | null
          total_talk_time_seconds: number | null
          updated_at: string | null
          voicemail_rate: number | null
          voicemails_left: number | null
        }
        Insert: {
          avg_call_duration_seconds?: number | null
          avg_composite_score?: number | null
          avg_interest_score?: number | null
          avg_quality_score?: number | null
          caller_name?: string | null
          connect_rate?: number | null
          connections?: number | null
          conversation_rate?: number | null
          conversations?: number | null
          created_at?: string | null
          date: string
          dm_conversations?: number | null
          engagement_id?: string | null
          id?: string
          meeting_rate?: number | null
          meetings_booked?: number | null
          total_dials?: number | null
          total_talk_time_seconds?: number | null
          updated_at?: string | null
          voicemail_rate?: number | null
          voicemails_left?: number | null
        }
        Update: {
          avg_call_duration_seconds?: number | null
          avg_composite_score?: number | null
          avg_interest_score?: number | null
          avg_quality_score?: number | null
          caller_name?: string | null
          connect_rate?: number | null
          connections?: number | null
          conversation_rate?: number | null
          conversations?: number | null
          created_at?: string | null
          date?: string
          dm_conversations?: number | null
          engagement_id?: string | null
          id?: string
          meeting_rate?: number | null
          meetings_booked?: number | null
          total_dials?: number | null
          total_talk_time_seconds?: number | null
          updated_at?: string | null
          voicemail_rate?: number | null
          voicemails_left?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_calling_metrics_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_metrics: {
        Row: {
          auto_replies: number | null
          bounce_rate: number | null
          calls_connected: number | null
          calls_made: number | null
          campaign_id: string | null
          created_at: string | null
          data_source_id: string | null
          date: string
          dm_conversations: number | null
          emails_bounced: number | null
          emails_clicked: number | null
          emails_delivered: number | null
          emails_opened: number | null
          emails_replied: number | null
          emails_sent: number | null
          emails_unsubscribed: number | null
          engagement_id: string | null
          hard_bounces: number | null
          id: string
          is_estimated: boolean
          meetings_booked: number | null
          not_interested_replies: number | null
          open_rate: number | null
          positive_rate: number | null
          positive_replies: number | null
          reply_rate: number | null
          soft_bounces: number | null
          timing_replies: number | null
          unique_opens: number | null
          updated_at: string | null
          variant_id: string | null
          voicemails_left: number | null
        }
        Insert: {
          auto_replies?: number | null
          bounce_rate?: number | null
          calls_connected?: number | null
          calls_made?: number | null
          campaign_id?: string | null
          created_at?: string | null
          data_source_id?: string | null
          date: string
          dm_conversations?: number | null
          emails_bounced?: number | null
          emails_clicked?: number | null
          emails_delivered?: number | null
          emails_opened?: number | null
          emails_replied?: number | null
          emails_sent?: number | null
          emails_unsubscribed?: number | null
          engagement_id?: string | null
          hard_bounces?: number | null
          id?: string
          is_estimated?: boolean
          meetings_booked?: number | null
          not_interested_replies?: number | null
          open_rate?: number | null
          positive_rate?: number | null
          positive_replies?: number | null
          reply_rate?: number | null
          soft_bounces?: number | null
          timing_replies?: number | null
          unique_opens?: number | null
          updated_at?: string | null
          variant_id?: string | null
          voicemails_left?: number | null
        }
        Update: {
          auto_replies?: number | null
          bounce_rate?: number | null
          calls_connected?: number | null
          calls_made?: number | null
          campaign_id?: string | null
          created_at?: string | null
          data_source_id?: string | null
          date?: string
          dm_conversations?: number | null
          emails_bounced?: number | null
          emails_clicked?: number | null
          emails_delivered?: number | null
          emails_opened?: number | null
          emails_replied?: number | null
          emails_sent?: number | null
          emails_unsubscribed?: number | null
          engagement_id?: string | null
          hard_bounces?: number | null
          id?: string
          is_estimated?: boolean
          meetings_booked?: number | null
          not_interested_replies?: number | null
          open_rate?: number | null
          positive_rate?: number | null
          positive_replies?: number | null
          reply_rate?: number | null
          soft_bounces?: number | null
          timing_replies?: number | null
          unique_opens?: number | null
          updated_at?: string | null
          variant_id?: string | null
          voicemails_left?: number | null
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
            foreignKeyName: "daily_metrics_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_metrics_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
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
        ]
      }
      data_sources: {
        Row: {
          access_token: string | null
          additional_config: Json | null
          api_key_encrypted: string | null
          api_secret_encrypted: string | null
          avg_sync_duration_ms: number | null
          created_at: string | null
          failed_syncs: number | null
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_records_processed: number | null
          last_sync_status: string | null
          name: string
          refresh_token: string | null
          source_type: string
          status: string | null
          sync_enabled: boolean | null
          sync_frequency: string | null
          token_expires_at: string | null
          total_syncs: number | null
          updated_at: string | null
          webhook_secret: string | null
        }
        Insert: {
          access_token?: string | null
          additional_config?: Json | null
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          avg_sync_duration_ms?: number | null
          created_at?: string | null
          failed_syncs?: number | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_records_processed?: number | null
          last_sync_status?: string | null
          name: string
          refresh_token?: string | null
          source_type: string
          status?: string | null
          sync_enabled?: boolean | null
          sync_frequency?: string | null
          token_expires_at?: string | null
          total_syncs?: number | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string | null
          additional_config?: Json | null
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          avg_sync_duration_ms?: number | null
          created_at?: string | null
          failed_syncs?: number | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_records_processed?: number | null
          last_sync_status?: string | null
          name?: string
          refresh_token?: string | null
          source_type?: string
          status?: string | null
          sync_enabled?: boolean | null
          sync_frequency?: string | null
          token_expires_at?: string | null
          total_syncs?: number | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Relationships: []
      }
      deal_clients: {
        Row: {
          client_type: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          engagement_id: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          client_type?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          engagement_id?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          client_type?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          engagement_id?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_clients_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          asking_price: number | null
          asking_price_display: string | null
          assigned_to: string | null
          business_description: string | null
          cim_url: string | null
          client_name: string | null
          created_at: string | null
          deal_client_id: string | null
          ebitda: number | null
          ebitda_display: string | null
          ebitda_multiple: number | null
          engagement_id: string | null
          geography: string | null
          id: string
          industry: string | null
          nda_signed_date: string | null
          notes: string | null
          pass_reason: string | null
          project_name: string
          received_at: string | null
          revenue: number | null
          revenue_display: string | null
          revenue_multiple: number | null
          source_company_id: string | null
          source_contact_id: string | null
          source_meeting_id: string | null
          source_type: string | null
          stage: string
          sub_industry: string | null
          teaser_url: string | null
          updated_at: string | null
        }
        Insert: {
          asking_price?: number | null
          asking_price_display?: string | null
          assigned_to?: string | null
          business_description?: string | null
          cim_url?: string | null
          client_name?: string | null
          created_at?: string | null
          deal_client_id?: string | null
          ebitda?: number | null
          ebitda_display?: string | null
          ebitda_multiple?: number | null
          engagement_id?: string | null
          geography?: string | null
          id?: string
          industry?: string | null
          nda_signed_date?: string | null
          notes?: string | null
          pass_reason?: string | null
          project_name: string
          received_at?: string | null
          revenue?: number | null
          revenue_display?: string | null
          revenue_multiple?: number | null
          source_company_id?: string | null
          source_contact_id?: string | null
          source_meeting_id?: string | null
          source_type?: string | null
          stage?: string
          sub_industry?: string | null
          teaser_url?: string | null
          updated_at?: string | null
        }
        Update: {
          asking_price?: number | null
          asking_price_display?: string | null
          assigned_to?: string | null
          business_description?: string | null
          cim_url?: string | null
          client_name?: string | null
          created_at?: string | null
          deal_client_id?: string | null
          ebitda?: number | null
          ebitda_display?: string | null
          ebitda_multiple?: number | null
          engagement_id?: string | null
          geography?: string | null
          id?: string
          industry?: string | null
          nda_signed_date?: string | null
          notes?: string | null
          pass_reason?: string | null
          project_name?: string
          received_at?: string | null
          revenue?: number | null
          revenue_display?: string | null
          revenue_multiple?: number | null
          source_company_id?: string | null
          source_contact_id?: string | null
          source_meeting_id?: string | null
          source_type?: string | null
          stage?: string
          sub_industry?: string | null
          teaser_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_deal_client_id_fkey"
            columns: ["deal_client_id"]
            isOneToOne: false
            referencedRelation: "deal_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_source_company_id_fkey"
            columns: ["source_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_source_contact_id_fkey"
            columns: ["source_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_source_meeting_id_fkey"
            columns: ["source_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      disposition_mappings: {
        Row: {
          created_at: string | null
          description: string | null
          engagement_id: string
          external_disposition: string
          id: string
          internal_disposition: string
          is_connection: boolean | null
          is_conversation: boolean | null
          is_dm: boolean | null
          is_meeting: boolean | null
          is_voicemail: boolean | null
          min_talk_duration_seconds: number | null
          platform: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          engagement_id: string
          external_disposition: string
          id?: string
          internal_disposition: string
          is_connection?: boolean | null
          is_conversation?: boolean | null
          is_dm?: boolean | null
          is_meeting?: boolean | null
          is_voicemail?: boolean | null
          min_talk_duration_seconds?: number | null
          platform?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          engagement_id?: string
          external_disposition?: string
          id?: string
          internal_disposition?: string
          is_connection?: boolean | null
          is_conversation?: boolean | null
          is_dm?: boolean | null
          is_meeting?: boolean | null
          is_voicemail?: boolean | null
          min_talk_duration_seconds?: number | null
          platform?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disposition_mappings_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          account_type: string | null
          created_at: string | null
          custom_tracking_domain: string | null
          daily_sent_count: number | null
          data_source_id: string | null
          engagement_id: string | null
          external_id: string | null
          from_email: string
          from_name: string | null
          id: string
          imap_failure_error: string | null
          imap_host: string | null
          imap_port: number | null
          is_active: boolean | null
          is_imap_success: boolean | null
          is_smtp_success: boolean | null
          last_synced_at: string | null
          message_per_day: number | null
          smtp_failure_error: string | null
          smtp_host: string | null
          smtp_port: number | null
          updated_at: string | null
          warmup_enabled: boolean | null
          warmup_reputation: number | null
          warmup_sent_count: number | null
          warmup_spam_count: number | null
          warmup_status: string | null
        }
        Insert: {
          account_type?: string | null
          created_at?: string | null
          custom_tracking_domain?: string | null
          daily_sent_count?: number | null
          data_source_id?: string | null
          engagement_id?: string | null
          external_id?: string | null
          from_email: string
          from_name?: string | null
          id?: string
          imap_failure_error?: string | null
          imap_host?: string | null
          imap_port?: number | null
          is_active?: boolean | null
          is_imap_success?: boolean | null
          is_smtp_success?: boolean | null
          last_synced_at?: string | null
          message_per_day?: number | null
          smtp_failure_error?: string | null
          smtp_host?: string | null
          smtp_port?: number | null
          updated_at?: string | null
          warmup_enabled?: boolean | null
          warmup_reputation?: number | null
          warmup_sent_count?: number | null
          warmup_spam_count?: number | null
          warmup_status?: string | null
        }
        Update: {
          account_type?: string | null
          created_at?: string | null
          custom_tracking_domain?: string | null
          daily_sent_count?: number | null
          data_source_id?: string | null
          engagement_id?: string | null
          external_id?: string | null
          from_email?: string
          from_name?: string | null
          id?: string
          imap_failure_error?: string | null
          imap_host?: string | null
          imap_port?: number | null
          is_active?: boolean | null
          is_imap_success?: boolean | null
          is_smtp_success?: boolean | null
          last_synced_at?: string | null
          message_per_day?: number | null
          smtp_failure_error?: string | null
          smtp_host?: string | null
          smtp_port?: number | null
          updated_at?: string | null
          warmup_enabled?: boolean | null
          warmup_reputation?: number | null
          warmup_sent_count?: number | null
          warmup_spam_count?: number | null
          warmup_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_accounts_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_accounts_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      email_activities: {
        Row: {
          body_preview: string | null
          bounce_reason: string | null
          bounce_type: string | null
          bounced: boolean | null
          bounced_at: string | null
          campaign_id: string | null
          category_id: string | null
          click_count: number | null
          clicked: boolean | null
          company_id: string
          contact_id: string
          created_at: string | null
          data_source_id: string | null
          delivered: boolean | null
          delivered_at: string | null
          email_account_id: string | null
          engagement_id: string
          external_id: string | null
          external_message_id: string | null
          first_clicked_at: string | null
          first_opened_at: string | null
          from_email: string | null
          from_name: string | null
          id: string
          is_interested: boolean | null
          last_opened_at: string | null
          lead_category: string | null
          link_clicks: Json | null
          marked_spam: boolean | null
          open_count: number | null
          open_timestamps: Json | null
          opened: boolean | null
          raw_data: Json | null
          replied: boolean | null
          replied_at: string | null
          reply_category: string | null
          reply_sentiment: string | null
          reply_text: string | null
          scheduled_at: string | null
          sent: boolean | null
          sent_at: string | null
          sequence_id: string | null
          spam_reported_at: string | null
          step_number: number | null
          subject: string | null
          synced_at: string | null
          to_email: string
          unsubscribed: boolean | null
          unsubscribed_at: string | null
          updated_at: string | null
          variant_id: string | null
        }
        Insert: {
          body_preview?: string | null
          bounce_reason?: string | null
          bounce_type?: string | null
          bounced?: boolean | null
          bounced_at?: string | null
          campaign_id?: string | null
          category_id?: string | null
          click_count?: number | null
          clicked?: boolean | null
          company_id: string
          contact_id: string
          created_at?: string | null
          data_source_id?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          email_account_id?: string | null
          engagement_id: string
          external_id?: string | null
          external_message_id?: string | null
          first_clicked_at?: string | null
          first_opened_at?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          is_interested?: boolean | null
          last_opened_at?: string | null
          lead_category?: string | null
          link_clicks?: Json | null
          marked_spam?: boolean | null
          open_count?: number | null
          open_timestamps?: Json | null
          opened?: boolean | null
          raw_data?: Json | null
          replied?: boolean | null
          replied_at?: string | null
          reply_category?: string | null
          reply_sentiment?: string | null
          reply_text?: string | null
          scheduled_at?: string | null
          sent?: boolean | null
          sent_at?: string | null
          sequence_id?: string | null
          spam_reported_at?: string | null
          step_number?: number | null
          subject?: string | null
          synced_at?: string | null
          to_email: string
          unsubscribed?: boolean | null
          unsubscribed_at?: string | null
          updated_at?: string | null
          variant_id?: string | null
        }
        Update: {
          body_preview?: string | null
          bounce_reason?: string | null
          bounce_type?: string | null
          bounced?: boolean | null
          bounced_at?: string | null
          campaign_id?: string | null
          category_id?: string | null
          click_count?: number | null
          clicked?: boolean | null
          company_id?: string
          contact_id?: string
          created_at?: string | null
          data_source_id?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          email_account_id?: string | null
          engagement_id?: string
          external_id?: string | null
          external_message_id?: string | null
          first_clicked_at?: string | null
          first_opened_at?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          is_interested?: boolean | null
          last_opened_at?: string | null
          lead_category?: string | null
          link_clicks?: Json | null
          marked_spam?: boolean | null
          open_count?: number | null
          open_timestamps?: Json | null
          opened?: boolean | null
          raw_data?: Json | null
          replied?: boolean | null
          replied_at?: string | null
          reply_category?: string | null
          reply_sentiment?: string | null
          reply_text?: string | null
          scheduled_at?: string | null
          sent?: boolean | null
          sent_at?: string | null
          sequence_id?: string | null
          spam_reported_at?: string | null
          step_number?: number | null
          subject?: string | null
          synced_at?: string | null
          to_email?: string
          unsubscribed?: boolean | null
          unsubscribed_at?: string | null
          updated_at?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_activities_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_activities_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "lead_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_activities_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_activities_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_activities_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_activities_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_activities_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "campaign_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_activities_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "copy_performance"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      engagements: {
        Row: {
          analyst_2_id: string | null
          analyst_id: string | null
          associate_id: string | null
          auto_created: boolean | null
          client_id: string
          companies_goal: number | null
          created_at: string | null
          deal_lead_id: string | null
          deleted_at: string | null
          description: string | null
          end_date: string | null
          fee_schedule: string | null
          id: string
          industry: string | null
          is_platform: boolean | null
          meeting_goal: number | null
          monthly_retainer: number | null
          name: string
          portfolio_company: string | null
          research_lead_id: string | null
          research_mid_id: string | null
          response_goal: number | null
          sponsor_name: string | null
          start_date: string | null
          status: string | null
          target_criteria: Json | null
          target_list_size: number | null
          updated_at: string | null
        }
        Insert: {
          analyst_2_id?: string | null
          analyst_id?: string | null
          associate_id?: string | null
          auto_created?: boolean | null
          client_id: string
          companies_goal?: number | null
          created_at?: string | null
          deal_lead_id?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          fee_schedule?: string | null
          id?: string
          industry?: string | null
          is_platform?: boolean | null
          meeting_goal?: number | null
          monthly_retainer?: number | null
          name: string
          portfolio_company?: string | null
          research_lead_id?: string | null
          research_mid_id?: string | null
          response_goal?: number | null
          sponsor_name?: string | null
          start_date?: string | null
          status?: string | null
          target_criteria?: Json | null
          target_list_size?: number | null
          updated_at?: string | null
        }
        Update: {
          analyst_2_id?: string | null
          analyst_id?: string | null
          associate_id?: string | null
          auto_created?: boolean | null
          client_id?: string
          companies_goal?: number | null
          created_at?: string | null
          deal_lead_id?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          fee_schedule?: string | null
          id?: string
          industry?: string | null
          is_platform?: boolean | null
          meeting_goal?: number | null
          monthly_retainer?: number | null
          name?: string
          portfolio_company?: string | null
          research_lead_id?: string | null
          research_mid_id?: string | null
          response_goal?: number | null
          sponsor_name?: string | null
          start_date?: string | null
          status?: string | null
          target_criteria?: Json | null
          target_list_size?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engagements_analyst_2_id_fkey"
            columns: ["analyst_2_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_analyst_id_fkey"
            columns: ["analyst_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_associate_id_fkey"
            columns: ["associate_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_deal_lead_id_fkey"
            columns: ["deal_lead_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_research_lead_id_fkey"
            columns: ["research_lead_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_research_mid_id_fkey"
            columns: ["research_mid_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_snapshots: {
        Row: {
          blocked: number | null
          campaign_id: string | null
          completed: number | null
          created_at: string | null
          date: string
          engagement_id: string | null
          id: string
          in_progress: number | null
          not_started: number | null
          paused: number | null
          total_leads: number | null
          unsubscribed: number | null
        }
        Insert: {
          blocked?: number | null
          campaign_id?: string | null
          completed?: number | null
          created_at?: string | null
          date: string
          engagement_id?: string | null
          id?: string
          in_progress?: number | null
          not_started?: number | null
          paused?: number | null
          total_leads?: number | null
          unsubscribed?: number | null
        }
        Update: {
          blocked?: number | null
          campaign_id?: string | null
          completed?: number | null
          created_at?: string | null
          date?: string
          engagement_id?: string | null
          id?: string
          in_progress?: number | null
          not_started?: number | null
          paused?: number | null
          total_leads?: number | null
          unsubscribed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_snapshots_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_snapshots_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_variants: {
        Row: {
          campaign_variant_id: string | null
          ci_lower: number | null
          ci_upper: number | null
          content_diff: Json | null
          created_at: string | null
          experiment_id: string
          id: string
          is_control: boolean | null
          margin_of_error: number | null
          name: string
          reply_rate: number | null
          status: string | null
          total_replied: number | null
          total_sent: number | null
          updated_at: string | null
        }
        Insert: {
          campaign_variant_id?: string | null
          ci_lower?: number | null
          ci_upper?: number | null
          content_diff?: Json | null
          created_at?: string | null
          experiment_id: string
          id?: string
          is_control?: boolean | null
          margin_of_error?: number | null
          name: string
          reply_rate?: number | null
          status?: string | null
          total_replied?: number | null
          total_sent?: number | null
          updated_at?: string | null
        }
        Update: {
          campaign_variant_id?: string | null
          ci_lower?: number | null
          ci_upper?: number | null
          content_diff?: Json | null
          created_at?: string | null
          experiment_id?: string
          id?: string
          is_control?: boolean | null
          margin_of_error?: number | null
          name?: string
          reply_rate?: number | null
          status?: string | null
          total_replied?: number | null
          total_sent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "experiment_variants_campaign_variant_id_fkey"
            columns: ["campaign_variant_id"]
            isOneToOne: false
            referencedRelation: "campaign_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_variants_campaign_variant_id_fkey"
            columns: ["campaign_variant_id"]
            isOneToOne: false
            referencedRelation: "copy_performance"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "experiment_variants_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      experiments: {
        Row: {
          actual_sample_size: number | null
          campaign_id: string | null
          completed_at: string | null
          confidence_level: number | null
          created_at: string | null
          engagement_id: string
          hypothesis: string | null
          id: string
          name: string
          p_value: number | null
          result: string | null
          started_at: string | null
          status: string | null
          target_sample_size: number | null
          test_variable: string
          updated_at: string | null
          winning_variant_id: string | null
        }
        Insert: {
          actual_sample_size?: number | null
          campaign_id?: string | null
          completed_at?: string | null
          confidence_level?: number | null
          created_at?: string | null
          engagement_id: string
          hypothesis?: string | null
          id?: string
          name: string
          p_value?: number | null
          result?: string | null
          started_at?: string | null
          status?: string | null
          target_sample_size?: number | null
          test_variable: string
          updated_at?: string | null
          winning_variant_id?: string | null
        }
        Update: {
          actual_sample_size?: number | null
          campaign_id?: string | null
          completed_at?: string | null
          confidence_level?: number | null
          created_at?: string | null
          engagement_id?: string
          hypothesis?: string | null
          id?: string
          name?: string
          p_value?: number | null
          result?: string | null
          started_at?: string | null
          status?: string | null
          target_sample_size?: number | null
          test_variable?: string
          updated_at?: string | null
          winning_variant_id?: string | null
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
            foreignKeyName: "experiments_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      external_call_intel: {
        Row: {
          ai_model_used: string | null
          buyer_type_preference: string | null
          call_id: string
          conversation_quality_justification: string | null
          conversation_quality_score: number | null
          created_at: string
          discovery_justification: string | null
          discovery_score: number | null
          engagement_id: string
          id: string
          interest_in_selling: string | null
          next_steps: string | null
          next_steps_clarity_justification: string | null
          next_steps_clarity_score: number | null
          number_of_objections: number | null
          objection_details: Json | null
          objection_handling_justification: string | null
          objection_handling_score: number | null
          objections_list: string[] | null
          objections_resolved_count: number | null
          overall_quality_justification: string | null
          overall_quality_score: number | null
          personal_insights: string | null
          personal_insights_justification: string | null
          personal_insights_score: number | null
          processed_at: string | null
          question_adherence_justification: string | null
          question_adherence_score: number | null
          questions_covered_count: number | null
          questions_covered_list: string[] | null
          rapport_building_justification: string | null
          rapport_building_score: number | null
          script_adherence_justification: string | null
          script_adherence_score: number | null
          seller_interest_justification: string | null
          seller_interest_score: number | null
          target_pain_points: string[] | null
          timeline_to_sell: string | null
          transcription_used: string | null
          updated_at: string
          valuation_discussion_justification: string | null
          valuation_discussion_score: number | null
          value_proposition_justification: string | null
          value_proposition_score: number | null
        }
        Insert: {
          ai_model_used?: string | null
          buyer_type_preference?: string | null
          call_id: string
          conversation_quality_justification?: string | null
          conversation_quality_score?: number | null
          created_at?: string
          discovery_justification?: string | null
          discovery_score?: number | null
          engagement_id: string
          id?: string
          interest_in_selling?: string | null
          next_steps?: string | null
          next_steps_clarity_justification?: string | null
          next_steps_clarity_score?: number | null
          number_of_objections?: number | null
          objection_details?: Json | null
          objection_handling_justification?: string | null
          objection_handling_score?: number | null
          objections_list?: string[] | null
          objections_resolved_count?: number | null
          overall_quality_justification?: string | null
          overall_quality_score?: number | null
          personal_insights?: string | null
          personal_insights_justification?: string | null
          personal_insights_score?: number | null
          processed_at?: string | null
          question_adherence_justification?: string | null
          question_adherence_score?: number | null
          questions_covered_count?: number | null
          questions_covered_list?: string[] | null
          rapport_building_justification?: string | null
          rapport_building_score?: number | null
          script_adherence_justification?: string | null
          script_adherence_score?: number | null
          seller_interest_justification?: string | null
          seller_interest_score?: number | null
          target_pain_points?: string[] | null
          timeline_to_sell?: string | null
          transcription_used?: string | null
          updated_at?: string
          valuation_discussion_justification?: string | null
          valuation_discussion_score?: number | null
          value_proposition_justification?: string | null
          value_proposition_score?: number | null
        }
        Update: {
          ai_model_used?: string | null
          buyer_type_preference?: string | null
          call_id?: string
          conversation_quality_justification?: string | null
          conversation_quality_score?: number | null
          created_at?: string
          discovery_justification?: string | null
          discovery_score?: number | null
          engagement_id?: string
          id?: string
          interest_in_selling?: string | null
          next_steps?: string | null
          next_steps_clarity_justification?: string | null
          next_steps_clarity_score?: number | null
          number_of_objections?: number | null
          objection_details?: Json | null
          objection_handling_justification?: string | null
          objection_handling_score?: number | null
          objections_list?: string[] | null
          objections_resolved_count?: number | null
          overall_quality_justification?: string | null
          overall_quality_score?: number | null
          personal_insights?: string | null
          personal_insights_justification?: string | null
          personal_insights_score?: number | null
          processed_at?: string | null
          question_adherence_justification?: string | null
          question_adherence_score?: number | null
          questions_covered_count?: number | null
          questions_covered_list?: string[] | null
          rapport_building_justification?: string | null
          rapport_building_score?: number | null
          script_adherence_justification?: string | null
          script_adherence_score?: number | null
          seller_interest_justification?: string | null
          seller_interest_score?: number | null
          target_pain_points?: string[] | null
          timeline_to_sell?: string | null
          transcription_used?: string | null
          updated_at?: string
          valuation_discussion_justification?: string | null
          valuation_discussion_score?: number | null
          value_proposition_justification?: string | null
          value_proposition_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "external_call_intel_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: true
            referencedRelation: "call_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_call_intel_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      function_logs: {
        Row: {
          created_at: string
          engagement_id: string | null
          function_name: string
          id: string
          level: string
          message: string
          metadata: Json | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          engagement_id?: string | null
          function_name: string
          id?: string
          level: string
          message: string
          metadata?: Json | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          engagement_id?: string | null
          function_name?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      hourly_metrics: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          day_of_week: number
          emails_bounced: number | null
          emails_clicked: number | null
          emails_opened: number | null
          emails_replied: number | null
          emails_sent: number | null
          engagement_id: string | null
          hour_of_day: number
          id: string
          metric_date: string
          updated_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          day_of_week: number
          emails_bounced?: number | null
          emails_clicked?: number | null
          emails_opened?: number | null
          emails_replied?: number | null
          emails_sent?: number | null
          engagement_id?: string | null
          hour_of_day: number
          id?: string
          metric_date: string
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          day_of_week?: number
          emails_bounced?: number | null
          emails_clicked?: number | null
          emails_opened?: number | null
          emails_replied?: number | null
          emails_sent?: number | null
          engagement_id?: string | null
          hour_of_day?: number
          id?: string
          metric_date?: string
          updated_at?: string | null
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
            foreignKeyName: "hourly_metrics_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      isp_deliverability: {
        Row: {
          bounced_count: number | null
          campaign_id: string | null
          clicked_count: number | null
          created_at: string | null
          delivered_count: number | null
          engagement_id: string | null
          hard_bounce_count: number | null
          id: string
          isp_name: string
          metric_date: string
          opened_count: number | null
          replied_count: number | null
          sent_count: number | null
          soft_bounce_count: number | null
          updated_at: string | null
        }
        Insert: {
          bounced_count?: number | null
          campaign_id?: string | null
          clicked_count?: number | null
          created_at?: string | null
          delivered_count?: number | null
          engagement_id?: string | null
          hard_bounce_count?: number | null
          id?: string
          isp_name: string
          metric_date: string
          opened_count?: number | null
          replied_count?: number | null
          sent_count?: number | null
          soft_bounce_count?: number | null
          updated_at?: string | null
        }
        Update: {
          bounced_count?: number | null
          campaign_id?: string | null
          clicked_count?: number | null
          created_at?: string | null
          delivered_count?: number | null
          engagement_id?: string | null
          hard_bounce_count?: number | null
          id?: string
          isp_name?: string
          metric_date?: string
          opened_count?: number | null
          replied_count?: number | null
          sent_count?: number | null
          soft_bounce_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "isp_deliverability_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "isp_deliverability_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_categories: {
        Row: {
          color: string | null
          created_at: string | null
          data_source_id: string | null
          engagement_id: string | null
          external_id: string | null
          id: string
          is_meeting: boolean | null
          is_ooo: boolean | null
          is_positive: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          data_source_id?: string | null
          engagement_id?: string | null
          external_id?: string | null
          id?: string
          is_meeting?: boolean | null
          is_ooo?: boolean | null
          is_positive?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          data_source_id?: string | null
          engagement_id?: string | null
          external_id?: string | null
          id?: string
          is_meeting?: boolean | null
          is_ooo?: boolean | null
          is_positive?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_categories_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_categories_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      link_click_tracking: {
        Row: {
          campaign_id: string | null
          click_count: number | null
          clicked_at: string
          contact_id: string | null
          created_at: string | null
          engagement_id: string | null
          id: string
          link_text: string | null
          link_url: string
          variant_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          click_count?: number | null
          clicked_at: string
          contact_id?: string | null
          created_at?: string | null
          engagement_id?: string | null
          id?: string
          link_text?: string | null
          link_url: string
          variant_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          click_count?: number | null
          clicked_at?: string
          contact_id?: string | null
          created_at?: string | null
          engagement_id?: string | null
          id?: string
          link_text?: string | null
          link_url?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_click_tracking_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_click_tracking_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_click_tracking_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_click_tracking_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "campaign_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_click_tracking_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "copy_performance"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      meetings: {
        Row: {
          booked_at: string | null
          calendar_event_id: string | null
          calendar_provider: string | null
          cancelled_at: string | null
          client_attendees: Json | null
          company_id: string
          completed_at: string | null
          confirmed_at: string | null
          contact_id: string
          created_at: string | null
          days_to_meeting: number | null
          description: string | null
          duration_minutes: number | null
          engagement_id: string
          id: string
          internal_attendees: Json | null
          location_type: string | null
          meeting_address: string | null
          meeting_link: string | null
          meeting_phone: string | null
          meeting_type: string | null
          outcome: string | null
          outcome_notes: string | null
          response_id: string | null
          scheduled_datetime: string | null
          source_campaign_id: string | null
          source_channel: string | null
          source_variant_id: string | null
          status: string | null
          target_attendees: Json | null
          timezone: string | null
          title: string | null
          touch_count_at_booking: number | null
          updated_at: string | null
        }
        Insert: {
          booked_at?: string | null
          calendar_event_id?: string | null
          calendar_provider?: string | null
          cancelled_at?: string | null
          client_attendees?: Json | null
          company_id: string
          completed_at?: string | null
          confirmed_at?: string | null
          contact_id: string
          created_at?: string | null
          days_to_meeting?: number | null
          description?: string | null
          duration_minutes?: number | null
          engagement_id: string
          id?: string
          internal_attendees?: Json | null
          location_type?: string | null
          meeting_address?: string | null
          meeting_link?: string | null
          meeting_phone?: string | null
          meeting_type?: string | null
          outcome?: string | null
          outcome_notes?: string | null
          response_id?: string | null
          scheduled_datetime?: string | null
          source_campaign_id?: string | null
          source_channel?: string | null
          source_variant_id?: string | null
          status?: string | null
          target_attendees?: Json | null
          timezone?: string | null
          title?: string | null
          touch_count_at_booking?: number | null
          updated_at?: string | null
        }
        Update: {
          booked_at?: string | null
          calendar_event_id?: string | null
          calendar_provider?: string | null
          cancelled_at?: string | null
          client_attendees?: Json | null
          company_id?: string
          completed_at?: string | null
          confirmed_at?: string | null
          contact_id?: string
          created_at?: string | null
          days_to_meeting?: number | null
          description?: string | null
          duration_minutes?: number | null
          engagement_id?: string
          id?: string
          internal_attendees?: Json | null
          location_type?: string | null
          meeting_address?: string | null
          meeting_link?: string | null
          meeting_phone?: string | null
          meeting_type?: string | null
          outcome?: string | null
          outcome_notes?: string | null
          response_id?: string | null
          scheduled_datetime?: string | null
          source_campaign_id?: string | null
          source_channel?: string | null
          source_variant_id?: string | null
          status?: string | null
          target_attendees?: Json | null
          timezone?: string | null
          title?: string | null
          touch_count_at_booking?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_source_campaign_id_fkey"
            columns: ["source_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_source_variant_id_fkey"
            columns: ["source_variant_id"]
            isOneToOne: false
            referencedRelation: "campaign_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_source_variant_id_fkey"
            columns: ["source_variant_id"]
            isOneToOne: false
            referencedRelation: "copy_performance"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      message_threads: {
        Row: {
          body_html: string | null
          body_plain: string | null
          body_preview: string | null
          campaign_id: string | null
          contact_id: string | null
          created_at: string | null
          email_activity_id: string | null
          engagement_id: string | null
          external_stats_id: string | null
          from_email: string | null
          from_name: string | null
          id: string
          in_reply_to: string | null
          is_automated: boolean | null
          message_id: string | null
          message_type: string
          sent_at: string | null
          sequence_number: number | null
          subject: string | null
          to_email: string | null
          to_name: string | null
        }
        Insert: {
          body_html?: string | null
          body_plain?: string | null
          body_preview?: string | null
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          email_activity_id?: string | null
          engagement_id?: string | null
          external_stats_id?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          in_reply_to?: string | null
          is_automated?: boolean | null
          message_id?: string | null
          message_type: string
          sent_at?: string | null
          sequence_number?: number | null
          subject?: string | null
          to_email?: string | null
          to_name?: string | null
        }
        Update: {
          body_html?: string | null
          body_plain?: string | null
          body_preview?: string | null
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          email_activity_id?: string | null
          engagement_id?: string | null
          external_stats_id?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          in_reply_to?: string | null
          is_automated?: boolean | null
          message_id?: string | null
          message_type?: string
          sent_at?: string | null
          sequence_number?: number | null
          subject?: string | null
          to_email?: string | null
          to_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_email_activity_id_fkey"
            columns: ["email_activity_id"]
            isOneToOne: false
            referencedRelation: "email_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      nocodb_campaign_daily_snapshots: {
        Row: {
          campaign_id: string
          campaign_name: string
          created_at: string | null
          emails_bounced: number | null
          emails_delivered: number | null
          emails_replied: number | null
          emails_sent: number | null
          id: string
          leads_active: number | null
          leads_completed: number | null
          leads_paused: number | null
          ooos: number | null
          optouts: number | null
          platform: string
          positive_replies: number | null
          snapshot_date: string
          status: string | null
          total_leads: number | null
        }
        Insert: {
          campaign_id: string
          campaign_name: string
          created_at?: string | null
          emails_bounced?: number | null
          emails_delivered?: number | null
          emails_replied?: number | null
          emails_sent?: number | null
          id?: string
          leads_active?: number | null
          leads_completed?: number | null
          leads_paused?: number | null
          ooos?: number | null
          optouts?: number | null
          platform: string
          positive_replies?: number | null
          snapshot_date: string
          status?: string | null
          total_leads?: number | null
        }
        Update: {
          campaign_id?: string
          campaign_name?: string
          created_at?: string | null
          emails_bounced?: number | null
          emails_delivered?: number | null
          emails_replied?: number | null
          emails_sent?: number | null
          id?: string
          leads_active?: number | null
          leads_completed?: number | null
          leads_paused?: number | null
          ooos?: number | null
          optouts?: number | null
          platform?: string
          positive_replies?: number | null
          snapshot_date?: string
          status?: string | null
          total_leads?: number | null
        }
        Relationships: []
      }
      nocodb_replyio_campaigns: {
        Row: {
          bounces: number | null
          campaign_created_date: string | null
          campaign_id: string
          campaign_name: string
          created_at: string
          deliveries: number | null
          id: string
          nocodb_created_at: string | null
          nocodb_id: number
          nocodb_updated_at: string | null
          ooos: number | null
          optouts: number | null
          people_active: number | null
          people_count: number | null
          people_finished: number | null
          people_paused: number | null
          replies: number | null
          status: string | null
          step1_body: string | null
          step1_subject: string | null
          step2_body: string | null
          step2_subject: string | null
          step3_body: string | null
          step3_subject: string | null
          step4_body: string | null
          step4_subject: string | null
          step5_body: string | null
          step5_subject: string | null
          step6_body: string | null
          step6_subject: string | null
          step7_body: string | null
          step7_subject: string | null
          step8_body: string | null
          step8_subject: string | null
          step9_body: string | null
          step9_subject: string | null
          synced_at: string
          updated_at: string
        }
        Insert: {
          bounces?: number | null
          campaign_created_date?: string | null
          campaign_id: string
          campaign_name: string
          created_at?: string
          deliveries?: number | null
          id?: string
          nocodb_created_at?: string | null
          nocodb_id: number
          nocodb_updated_at?: string | null
          ooos?: number | null
          optouts?: number | null
          people_active?: number | null
          people_count?: number | null
          people_finished?: number | null
          people_paused?: number | null
          replies?: number | null
          status?: string | null
          step1_body?: string | null
          step1_subject?: string | null
          step2_body?: string | null
          step2_subject?: string | null
          step3_body?: string | null
          step3_subject?: string | null
          step4_body?: string | null
          step4_subject?: string | null
          step5_body?: string | null
          step5_subject?: string | null
          step6_body?: string | null
          step6_subject?: string | null
          step7_body?: string | null
          step7_subject?: string | null
          step8_body?: string | null
          step8_subject?: string | null
          step9_body?: string | null
          step9_subject?: string | null
          synced_at?: string
          updated_at?: string
        }
        Update: {
          bounces?: number | null
          campaign_created_date?: string | null
          campaign_id?: string
          campaign_name?: string
          created_at?: string
          deliveries?: number | null
          id?: string
          nocodb_created_at?: string | null
          nocodb_id?: number
          nocodb_updated_at?: string | null
          ooos?: number | null
          optouts?: number | null
          people_active?: number | null
          people_count?: number | null
          people_finished?: number | null
          people_paused?: number | null
          replies?: number | null
          status?: string | null
          step1_body?: string | null
          step1_subject?: string | null
          step2_body?: string | null
          step2_subject?: string | null
          step3_body?: string | null
          step3_subject?: string | null
          step4_body?: string | null
          step4_subject?: string | null
          step5_body?: string | null
          step5_subject?: string | null
          step6_body?: string | null
          step6_subject?: string | null
          step7_body?: string | null
          step7_subject?: string | null
          step8_body?: string | null
          step8_subject?: string | null
          step9_body?: string | null
          step9_subject?: string | null
          synced_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      nocodb_smartlead_campaigns: {
        Row: {
          campaign_created_date: string | null
          campaign_id: string
          campaign_name: string
          created_at: string
          id: string
          leads_blocked: number | null
          leads_completed: number | null
          leads_in_progress: number | null
          leads_interested: number | null
          leads_not_started: number | null
          leads_paused: number | null
          leads_stopped: number | null
          link_to_campaign: string | null
          nocodb_created_at: string | null
          nocodb_id: number
          nocodb_updated_at: string | null
          status: string | null
          step1_body: string | null
          step1_subject: string | null
          step2_body: string | null
          step2_subject: string | null
          step3_body: string | null
          step3_subject: string | null
          step4_body: string | null
          step4_subject: string | null
          step5_body: string | null
          step5_subject: string | null
          step6_body: string | null
          step6_subject: string | null
          step7_body: string | null
          step7_subject: string | null
          step8_body: string | null
          step8_subject: string | null
          step9_body: string | null
          step9_subject: string | null
          steps_count: number | null
          synced_at: string
          total_bounces: number | null
          total_emails_sent: number | null
          total_leads: number | null
          total_replies: number | null
          unique_emails_sent: number | null
          updated_at: string
        }
        Insert: {
          campaign_created_date?: string | null
          campaign_id: string
          campaign_name: string
          created_at?: string
          id?: string
          leads_blocked?: number | null
          leads_completed?: number | null
          leads_in_progress?: number | null
          leads_interested?: number | null
          leads_not_started?: number | null
          leads_paused?: number | null
          leads_stopped?: number | null
          link_to_campaign?: string | null
          nocodb_created_at?: string | null
          nocodb_id: number
          nocodb_updated_at?: string | null
          status?: string | null
          step1_body?: string | null
          step1_subject?: string | null
          step2_body?: string | null
          step2_subject?: string | null
          step3_body?: string | null
          step3_subject?: string | null
          step4_body?: string | null
          step4_subject?: string | null
          step5_body?: string | null
          step5_subject?: string | null
          step6_body?: string | null
          step6_subject?: string | null
          step7_body?: string | null
          step7_subject?: string | null
          step8_body?: string | null
          step8_subject?: string | null
          step9_body?: string | null
          step9_subject?: string | null
          steps_count?: number | null
          synced_at?: string
          total_bounces?: number | null
          total_emails_sent?: number | null
          total_leads?: number | null
          total_replies?: number | null
          unique_emails_sent?: number | null
          updated_at?: string
        }
        Update: {
          campaign_created_date?: string | null
          campaign_id?: string
          campaign_name?: string
          created_at?: string
          id?: string
          leads_blocked?: number | null
          leads_completed?: number | null
          leads_in_progress?: number | null
          leads_interested?: number | null
          leads_not_started?: number | null
          leads_paused?: number | null
          leads_stopped?: number | null
          link_to_campaign?: string | null
          nocodb_created_at?: string | null
          nocodb_id?: number
          nocodb_updated_at?: string | null
          status?: string | null
          step1_body?: string | null
          step1_subject?: string | null
          step2_body?: string | null
          step2_subject?: string | null
          step3_body?: string | null
          step3_subject?: string | null
          step4_body?: string | null
          step4_subject?: string | null
          step5_body?: string | null
          step5_subject?: string | null
          step6_body?: string | null
          step6_subject?: string | null
          step7_body?: string | null
          step7_subject?: string | null
          step8_body?: string | null
          step8_subject?: string | null
          step9_body?: string | null
          step9_subject?: string | null
          steps_count?: number | null
          synced_at?: string
          total_bounces?: number | null
          total_emails_sent?: number | null
          total_leads?: number | null
          total_replies?: number | null
          unique_emails_sent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      playbook_entries: {
        Row: {
          context: string | null
          copy_library_id: string | null
          created_at: string | null
          created_by: string | null
          engagement_id: string | null
          experiment_id: string | null
          id: string
          metrics: Json | null
          tags: string[] | null
          test_type: string
          title: string
          updated_at: string | null
          winning_pattern: string
        }
        Insert: {
          context?: string | null
          copy_library_id?: string | null
          created_at?: string | null
          created_by?: string | null
          engagement_id?: string | null
          experiment_id?: string | null
          id?: string
          metrics?: Json | null
          tags?: string[] | null
          test_type: string
          title: string
          updated_at?: string | null
          winning_pattern: string
        }
        Update: {
          context?: string | null
          copy_library_id?: string | null
          created_at?: string | null
          created_by?: string | null
          engagement_id?: string | null
          experiment_id?: string | null
          id?: string
          metrics?: Json | null
          tags?: string[] | null
          test_type?: string
          title?: string
          updated_at?: string | null
          winning_pattern?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_entries_copy_library_id_fkey"
            columns: ["copy_library_id"]
            isOneToOne: false
            referencedRelation: "copy_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_entries_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_entries_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "experiments"
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
      reps: {
        Row: {
          created_at: string | null
          email: string | null
          engagement_id: string
          external_id: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          platform: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          engagement_id: string
          external_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          platform?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          engagement_id?: string
          external_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          platform?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reps_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      responses: {
        Row: {
          call_activity_id: string | null
          category: string
          company_id: string
          contact_id: string
          converted_to_meeting: boolean | null
          created_at: string | null
          email_activity_id: string | null
          engagement_id: string
          follow_up_date: string | null
          follow_up_notes: string | null
          full_text: string | null
          id: string
          meeting_id: string | null
          processed_at: string | null
          processed_by: string | null
          requires_follow_up: boolean | null
          response_channel: string
          response_datetime: string
          sentiment_label: string | null
          sentiment_score: number | null
          source_type: string
          sub_category: string | null
          summary: string | null
          updated_at: string | null
        }
        Insert: {
          call_activity_id?: string | null
          category: string
          company_id: string
          contact_id: string
          converted_to_meeting?: boolean | null
          created_at?: string | null
          email_activity_id?: string | null
          engagement_id: string
          follow_up_date?: string | null
          follow_up_notes?: string | null
          full_text?: string | null
          id?: string
          meeting_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          requires_follow_up?: boolean | null
          response_channel: string
          response_datetime: string
          sentiment_label?: string | null
          sentiment_score?: number | null
          source_type: string
          sub_category?: string | null
          summary?: string | null
          updated_at?: string | null
        }
        Update: {
          call_activity_id?: string | null
          category?: string
          company_id?: string
          contact_id?: string
          converted_to_meeting?: boolean | null
          created_at?: string | null
          email_activity_id?: string | null
          engagement_id?: string
          follow_up_date?: string | null
          follow_up_notes?: string | null
          full_text?: string | null
          id?: string
          meeting_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          requires_follow_up?: boolean | null
          response_channel?: string
          response_datetime?: string
          sentiment_label?: string | null
          sentiment_score?: number | null
          source_type?: string
          sub_category?: string | null
          summary?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_responses_meeting"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_call_activity_id_fkey"
            columns: ["call_activity_id"]
            isOneToOne: false
            referencedRelation: "call_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_email_activity_id_fkey"
            columns: ["email_activity_id"]
            isOneToOne: false
            referencedRelation: "email_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sending_domains: {
        Row: {
          bounce_rate: number | null
          created_at: string
          data_source_id: string | null
          dkim_record: string | null
          dkim_status: string | null
          dmarc_record: string | null
          dmarc_status: string | null
          domain: string
          engagement_id: string
          health_score: number | null
          id: string
          is_primary: boolean | null
          last_verified_at: string | null
          spam_complaint_rate: number | null
          spf_record: string | null
          spf_status: string | null
          total_bounced: number | null
          total_sent: number | null
          updated_at: string
        }
        Insert: {
          bounce_rate?: number | null
          created_at?: string
          data_source_id?: string | null
          dkim_record?: string | null
          dkim_status?: string | null
          dmarc_record?: string | null
          dmarc_status?: string | null
          domain: string
          engagement_id: string
          health_score?: number | null
          id?: string
          is_primary?: boolean | null
          last_verified_at?: string | null
          spam_complaint_rate?: number | null
          spf_record?: string | null
          spf_status?: string | null
          total_bounced?: number | null
          total_sent?: number | null
          updated_at?: string
        }
        Update: {
          bounce_rate?: number | null
          created_at?: string
          data_source_id?: string | null
          dkim_record?: string | null
          dkim_status?: string | null
          dmarc_record?: string | null
          dmarc_status?: string | null
          domain?: string
          engagement_id?: string
          health_score?: number | null
          id?: string
          is_primary?: boolean | null
          last_verified_at?: string | null
          spam_complaint_rate?: number | null
          spf_record?: string | null
          spf_status?: string | null
          total_bounced?: number | null
          total_sent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sending_domains_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sending_domains_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
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
        Relationships: []
      }
      sequences: {
        Row: {
          body_html: string | null
          body_plain: string | null
          body_template: string | null
          campaign_id: string
          created_at: string | null
          delay_days: number | null
          delay_hours: number | null
          external_id: string | null
          id: string
          open_rate: number | null
          reply_rate: number | null
          send_days: string[] | null
          send_window_end: string | null
          send_window_start: string | null
          status: string | null
          step_name: string | null
          step_number: number
          subject_line: string | null
          total_opened: number | null
          total_replied: number | null
          total_sent: number | null
          updated_at: string | null
        }
        Insert: {
          body_html?: string | null
          body_plain?: string | null
          body_template?: string | null
          campaign_id: string
          created_at?: string | null
          delay_days?: number | null
          delay_hours?: number | null
          external_id?: string | null
          id?: string
          open_rate?: number | null
          reply_rate?: number | null
          send_days?: string[] | null
          send_window_end?: string | null
          send_window_start?: string | null
          status?: string | null
          step_name?: string | null
          step_number: number
          subject_line?: string | null
          total_opened?: number | null
          total_replied?: number | null
          total_sent?: number | null
          updated_at?: string | null
        }
        Update: {
          body_html?: string | null
          body_plain?: string | null
          body_template?: string | null
          campaign_id?: string
          created_at?: string | null
          delay_days?: number | null
          delay_hours?: number | null
          external_id?: string | null
          id?: string
          open_rate?: number | null
          reply_rate?: number | null
          send_days?: string[] | null
          send_window_end?: string | null
          send_window_start?: string | null
          status?: string | null
          step_name?: string | null
          step_number?: number
          subject_line?: string | null
          total_opened?: number | null
          total_replied?: number | null
          total_sent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      smartlead_inbox_webhooks: {
        Row: {
          ai_category: string | null
          ai_confidence: number | null
          ai_is_positive: boolean | null
          ai_reasoning: string | null
          ai_sentiment: string | null
          app_url: string | null
          campaign_id: number | null
          campaign_name: string | null
          campaign_status: string | null
          categorized_at: string | null
          cc_emails: Json | null
          client_id: string | null
          created_at: string
          description: string | null
          event_timestamp: string | null
          event_type: string | null
          from_email: string | null
          id: string
          lead_correspondence: Json | null
          message_id: string | null
          metadata: Json | null
          preview_text: string | null
          processed: boolean | null
          processed_at: string | null
          raw_payload: Json | null
          reply_body: string | null
          reply_message: Json | null
          secret_key: string | null
          sent_message: Json | null
          sent_message_body: string | null
          sequence_number: number | null
          sl_email_lead_id: string | null
          sl_email_lead_map_id: number | null
          sl_lead_email: string | null
          stats_id: string | null
          subject: string | null
          time_replied: string | null
          to_email: string | null
          to_name: string | null
          ui_master_inbox_link: string | null
          webhook_id: number | null
          webhook_name: string | null
          webhook_url: string | null
        }
        Insert: {
          ai_category?: string | null
          ai_confidence?: number | null
          ai_is_positive?: boolean | null
          ai_reasoning?: string | null
          ai_sentiment?: string | null
          app_url?: string | null
          campaign_id?: number | null
          campaign_name?: string | null
          campaign_status?: string | null
          categorized_at?: string | null
          cc_emails?: Json | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          event_timestamp?: string | null
          event_type?: string | null
          from_email?: string | null
          id?: string
          lead_correspondence?: Json | null
          message_id?: string | null
          metadata?: Json | null
          preview_text?: string | null
          processed?: boolean | null
          processed_at?: string | null
          raw_payload?: Json | null
          reply_body?: string | null
          reply_message?: Json | null
          secret_key?: string | null
          sent_message?: Json | null
          sent_message_body?: string | null
          sequence_number?: number | null
          sl_email_lead_id?: string | null
          sl_email_lead_map_id?: number | null
          sl_lead_email?: string | null
          stats_id?: string | null
          subject?: string | null
          time_replied?: string | null
          to_email?: string | null
          to_name?: string | null
          ui_master_inbox_link?: string | null
          webhook_id?: number | null
          webhook_name?: string | null
          webhook_url?: string | null
        }
        Update: {
          ai_category?: string | null
          ai_confidence?: number | null
          ai_is_positive?: boolean | null
          ai_reasoning?: string | null
          ai_sentiment?: string | null
          app_url?: string | null
          campaign_id?: number | null
          campaign_name?: string | null
          campaign_status?: string | null
          categorized_at?: string | null
          cc_emails?: Json | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          event_timestamp?: string | null
          event_type?: string | null
          from_email?: string | null
          id?: string
          lead_correspondence?: Json | null
          message_id?: string | null
          metadata?: Json | null
          preview_text?: string | null
          processed?: boolean | null
          processed_at?: string | null
          raw_payload?: Json | null
          reply_body?: string | null
          reply_message?: Json | null
          secret_key?: string | null
          sent_message?: Json | null
          sent_message_body?: string | null
          sequence_number?: number | null
          sl_email_lead_id?: string | null
          sl_email_lead_map_id?: number | null
          sl_lead_email?: string | null
          stats_id?: string | null
          subject?: string | null
          time_replied?: string | null
          to_email?: string | null
          to_name?: string | null
          ui_master_inbox_link?: string | null
          webhook_id?: number | null
          webhook_name?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      source_id_mappings: {
        Row: {
          created_at: string | null
          data_source_id: string
          external_entity_type: string
          external_id: string
          id: string
          internal_entity_type: string
          internal_id: string
          source_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_source_id: string
          external_entity_type: string
          external_id: string
          id?: string
          internal_entity_type: string
          internal_id: string
          source_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_source_id?: string
          external_entity_type?: string
          external_id?: string
          id?: string
          internal_entity_type?: string
          internal_id?: string
          source_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_id_mappings_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_aliases: {
        Row: {
          alias: string
          canonical_name: string
          created_at: string | null
          id: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          alias: string
          canonical_name: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          alias?: string
          canonical_name?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_aliases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_errors: {
        Row: {
          created_at: string
          data_source_id: string | null
          error_message: string
          id: string
          operation: string
          platform: string
          raw_data: Json | null
          record_id: string | null
          resolved_at: string | null
          retry_count: number | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          data_source_id?: string | null
          error_message: string
          id?: string
          operation: string
          platform: string
          raw_data?: Json | null
          record_id?: string | null
          resolved_at?: string | null
          retry_count?: number | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          data_source_id?: string | null
          error_message?: string
          id?: string
          operation?: string
          platform?: string
          raw_data?: Json | null
          record_id?: string | null
          resolved_at?: string | null
          retry_count?: number | null
          workspace_id?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          cursor_state: Json | null
          data_source_id: string
          duration_ms: number | null
          entity_type: string | null
          error_details: Json | null
          error_message: string | null
          id: string
          records_created: number | null
          records_failed: number | null
          records_processed: number | null
          records_skipped: number | null
          records_updated: number | null
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          cursor_state?: Json | null
          data_source_id: string
          duration_ms?: number | null
          entity_type?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          records_created?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_skipped?: number | null
          records_updated?: number | null
          started_at: string
          status: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          cursor_state?: Json | null
          data_source_id?: string
          duration_ms?: number | null
          entity_type?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          records_created?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_skipped?: number | null
          records_updated?: number | null
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_progress: {
        Row: {
          completed_at: string | null
          current_campaign_name: string | null
          current_phase: string | null
          data_source_id: string | null
          engagement_id: string | null
          errors: Json | null
          id: string
          processed_campaigns: number | null
          records_synced: number | null
          started_at: string | null
          status: string | null
          total_campaigns: number | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          current_campaign_name?: string | null
          current_phase?: string | null
          data_source_id?: string | null
          engagement_id?: string | null
          errors?: Json | null
          id?: string
          processed_campaigns?: number | null
          records_synced?: number | null
          started_at?: string | null
          status?: string | null
          total_campaigns?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          current_campaign_name?: string | null
          current_phase?: string | null
          data_source_id?: string | null
          engagement_id?: string | null
          errors?: Json | null
          id?: string
          processed_campaigns?: number | null
          records_synced?: number | null
          started_at?: string | null
          status?: string | null
          total_campaigns?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_progress_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_progress_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_retry_queue: {
        Row: {
          created_at: string | null
          data_source_id: string | null
          engagement_id: string | null
          id: string
          last_error: string | null
          max_retries: number | null
          next_retry_at: string | null
          retry_count: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_source_id?: string | null
          engagement_id?: string | null
          id?: string
          last_error?: string | null
          max_retries?: number | null
          next_retry_at?: string | null
          retry_count?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_source_id?: string | null
          engagement_id?: string | null
          id?: string
          last_error?: string | null
          max_retries?: number | null
          next_retry_at?: string | null
          retry_count?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_retry_queue_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_retry_queue_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          client_id: string
          created_at: string | null
          email: string | null
          first_name: string
          id: string
          is_active: boolean | null
          last_name: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_decay_tracking: {
        Row: {
          campaign_id: string | null
          computed_at: string | null
          cumulative_replied: number | null
          cumulative_reply_rate: number | null
          cumulative_sent: number | null
          decay_rate: number | null
          engagement_id: string | null
          id: string
          period_end: string | null
          period_replied: number | null
          period_reply_rate: number | null
          period_sent: number | null
          period_start: string | null
          variant_id: string | null
          week_number: number
        }
        Insert: {
          campaign_id?: string | null
          computed_at?: string | null
          cumulative_replied?: number | null
          cumulative_reply_rate?: number | null
          cumulative_sent?: number | null
          decay_rate?: number | null
          engagement_id?: string | null
          id?: string
          period_end?: string | null
          period_replied?: number | null
          period_reply_rate?: number | null
          period_sent?: number | null
          period_start?: string | null
          variant_id?: string | null
          week_number: number
        }
        Update: {
          campaign_id?: string | null
          computed_at?: string | null
          cumulative_replied?: number | null
          cumulative_reply_rate?: number | null
          cumulative_sent?: number | null
          decay_rate?: number | null
          engagement_id?: string | null
          id?: string
          period_end?: string | null
          period_replied?: number | null
          period_reply_rate?: number | null
          period_sent?: number | null
          period_start?: string | null
          variant_id?: string | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "variant_decay_tracking_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_decay_tracking_engagement_fk"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_decay_tracking_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "campaign_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_decay_tracking_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "copy_performance"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string | null
          data_source_id: string | null
          engagement_id: string | null
          error_message: string | null
          event_type: string
          external_id: string | null
          id: string
          payload: Json | null
          processed: boolean | null
          processed_at: string | null
          source_type: string
        }
        Insert: {
          created_at?: string | null
          data_source_id?: string | null
          engagement_id?: string | null
          error_message?: string | null
          event_type: string
          external_id?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          source_type: string
        }
        Update: {
          created_at?: string | null
          data_source_id?: string | null
          engagement_id?: string | null
          error_message?: string | null
          event_type?: string
          external_id?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      activity_timeline: {
        Row: {
          activity_datetime: string | null
          activity_id: string | null
          activity_subtype: string | null
          activity_summary: string | null
          activity_type: string | null
          company_id: string | null
          contact_id: string | null
          engagement_id: string | null
        }
        Relationships: []
      }
      copy_performance: {
        Row: {
          body_preview: string | null
          bounce_rate: number | null
          campaign_id: string | null
          confidence_level: string | null
          engagement_id: string | null
          first_sent_at: string | null
          last_sent_at: string | null
          open_rate: number | null
          positive_replies: number | null
          positive_reply_rate: number | null
          reply_rate: number | null
          sample_size_sufficient: boolean | null
          step_number: number | null
          subject_line: string | null
          total_bounced: number | null
          total_opened: number | null
          total_replied: number | null
          total_sent: number | null
          variant_id: string | null
          variant_label: string | null
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
            foreignKeyName: "campaigns_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      nocodb_campaign_daily_deltas: {
        Row: {
          campaign_id: string | null
          campaign_name: string | null
          days_since_last: number | null
          emails_bounced: number | null
          emails_bounced_delta: number | null
          emails_replied: number | null
          emails_replied_delta: number | null
          emails_sent: number | null
          emails_sent_delta: number | null
          platform: string | null
          positive_delta: number | null
          positive_replies: number | null
          prev_snapshot_date: string | null
          snapshot_date: string | null
          status: string | null
          total_leads: number | null
        }
        Relationships: []
      }
      nocodb_daily_totals: {
        Row: {
          platform: string | null
          replied_delta: number | null
          sent_delta: number | null
          snapshot_date: string | null
          total_bounced: number | null
          total_campaigns: number | null
          total_leads: number | null
          total_positive: number | null
          total_replied: number | null
          total_sent: number | null
        }
        Relationships: []
      }
      segment_performance: {
        Row: {
          company_size_category: string | null
          contact_count: number | null
          department: string | null
          emails_replied: number | null
          emails_sent: number | null
          engagement_id: string | null
          positive_replies: number | null
          reply_rate: number | null
          seniority_level: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      backfill_reps_from_calls: { Args: never; Returns: undefined }
      calc_margin_of_error: {
        Args: { confidence?: number; successes: number; total: number }
        Returns: number
      }
      classify_email_isp: { Args: { email_address: string }; Returns: string }
      cleanup_old_function_logs: { Args: never; Returns: undefined }
      decrypt_api_key: { Args: { encrypted_value: string }; Returns: string }
      encrypt_api_key: { Args: { key_value: string }; Returns: string }
      get_client_id_from_engagement: {
        Args: { _engagement_id: string }
        Returns: string
      }
      get_decrypted_api_key: {
        Args: { connection_id: string }
        Returns: string
      }
      get_default_workspace: {
        Args: never
        Returns: {
          client_type: string
          created_at: string
          id: string
          name: string
          settings: Json
          slug: string
          status: string
          updated_at: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_variant_weekly_stats: {
        Args: { p_variant_id: string }
        Returns: {
          bounced: number
          opened: number
          positive: number
          replied: number
          sent: number
          week_start: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_campaign_metric: {
        Args: { p_campaign_id: string; p_metric_name: string; p_value?: number }
        Returns: undefined
      }
      increment_variant_metric: {
        Args: { p_metric_name: string; p_value?: number; p_variant_id: string }
        Returns: undefined
      }
      is_client_admin: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      is_client_member: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      is_connection_disposition: {
        Args: {
          p_disposition: string
          p_engagement_id: string
          p_talk_duration?: number
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
      join_default_client: { Args: never; Returns: string }
      upsert_daily_metric: {
        Args: {
          p_campaign_id: string
          p_date: string
          p_engagement_id: string
          p_metric_name: string
          p_value?: number
          p_variant_id?: string
        }
        Returns: undefined
      }
      upsert_hourly_metric: {
        Args: {
          p_campaign_id: string
          p_day_of_week: number
          p_engagement_id: string
          p_hour_of_day: number
          p_metric_date: string
          p_metric_name: string
          p_value?: number
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "analyst" | "viewer" | "manager" | "rep"
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
      app_role: ["admin", "analyst", "viewer", "manager", "rep"],
    },
  },
} as const
