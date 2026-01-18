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
      ai_chatbot_conversations: {
        Row: {
          created_at: string | null
          id: string
          title: string | null
          updated_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chatbot_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chatbot_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          data_sources_used: string[] | null
          id: string
          intent_category: string | null
          role: string
          visualizations: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          data_sources_used?: string[] | null
          id?: string
          intent_category?: string | null
          role: string
          visualizations?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          data_sources_used?: string[] | null
          id?: string
          intent_category?: string | null
          role?: string
          visualizations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_chatbot_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_chatbot_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_coaching_recommendations: {
        Row: {
          acknowledged_at: string | null
          created_at: string | null
          data_evidence: Json | null
          description: string
          id: string
          is_acknowledged: boolean | null
          priority: string | null
          recommendation_type: string
          rep_profile_id: string | null
          title: string
          valid_until: string | null
          workspace_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string | null
          data_evidence?: Json | null
          description: string
          id?: string
          is_acknowledged?: boolean | null
          priority?: string | null
          recommendation_type: string
          rep_profile_id?: string | null
          title: string
          valid_until?: string | null
          workspace_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string | null
          data_evidence?: Json | null
          description?: string
          id?: string
          is_acknowledged?: boolean | null
          priority?: string | null
          recommendation_type?: string
          rep_profile_id?: string | null
          title?: string
          valid_until?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_coaching_recommendations_rep_profile_id_fkey"
            columns: ["rep_profile_id"]
            isOneToOne: false
            referencedRelation: "rep_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_coaching_recommendations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_weekly_summaries: {
        Row: {
          areas_needing_attention: Json | null
          created_at: string | null
          generated_at: string | null
          id: string
          key_driver: string | null
          team_health_score: number | null
          team_health_trend: string | null
          week_end: string
          week_start: string
          weekly_focus_recommendations: Json | null
          whats_working: Json | null
          workspace_id: string
        }
        Insert: {
          areas_needing_attention?: Json | null
          created_at?: string | null
          generated_at?: string | null
          id?: string
          key_driver?: string | null
          team_health_score?: number | null
          team_health_trend?: string | null
          week_end: string
          week_start: string
          weekly_focus_recommendations?: Json | null
          whats_working?: Json | null
          workspace_id: string
        }
        Update: {
          areas_needing_attention?: Json | null
          created_at?: string | null
          generated_at?: string | null
          id?: string
          key_driver?: string | null
          team_health_score?: number | null
          team_health_trend?: string | null
          week_end?: string
          week_start?: string
          weekly_focus_recommendations?: Json | null
          whats_working?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_weekly_summaries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
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
      call_ai_scores: {
        Row: {
          best_time_to_call: string | null
          buyer_type_preference: string | null
          call_category: string | null
          call_id: string
          clarity_of_value_proposition_justification: string | null
          clarity_of_value_proposition_score: number | null
          composite_score: number | null
          correct_info_obtained: boolean | null
          created_at: string
          data_source: string | null
          decision_maker_identification: number | null
          direct_line_obtained: string | null
          engagement_justification: string | null
          engagement_score: number | null
          gatekeeper_handling_score: number | null
          gatekeeper_info_gathered: Json | null
          gatekeeper_name: string | null
          gatekeeper_outcome: string | null
          gatekeeper_technique_used: string | null
          gatekeeper_title: string | null
          id: string
          initial_valuation_discussion: number | null
          key_concerns: string[] | null
          key_topics_discussed: string[] | null
          mandatory_question_details: Json | null
          mandatory_questions_adherence: number | null
          mandatory_questions_asked: Json | null
          motivation_factors: string[] | null
          next_step_clarity_justification: string | null
          next_step_clarity_score: number | null
          not_interested_reason: string | null
          objection_handling_justification: string | null
          objection_handling_score: number | null
          objection_resolution_rate: number | null
          objection_to_resolution_rate: number | null
          objections_list: Json | null
          objections_text: string | null
          opening_type: string | null
          overall_quality_score: number | null
          owner_name_confirmed: string | null
          personal_insights: string | null
          quality_of_conversation_justification: string | null
          quality_of_conversation_score: number | null
          rapport_building_justification: string | null
          rapport_building_score: number | null
          referral_generation_rate: number | null
          scoring_model: string | null
          script_adherence_justification: string | null
          script_adherence_score: number | null
          seller_interest_justification: string | null
          seller_interest_score: number | null
          timeline_months: number | null
          timeline_to_sell: string | null
          transcript_id: string | null
          trigger_events: Json | null
          valuation_discussion_justification: string | null
          valuation_discussion_score: number | null
          valuation_multiple: number | null
          value_proposition_justification: string | null
          value_proposition_score: number | null
          workspace_id: string
          wrong_number_flag: boolean | null
          wrong_number_notes: string | null
          wrong_number_type: string | null
        }
        Insert: {
          best_time_to_call?: string | null
          buyer_type_preference?: string | null
          call_category?: string | null
          call_id: string
          clarity_of_value_proposition_justification?: string | null
          clarity_of_value_proposition_score?: number | null
          composite_score?: number | null
          correct_info_obtained?: boolean | null
          created_at?: string
          data_source?: string | null
          decision_maker_identification?: number | null
          direct_line_obtained?: string | null
          engagement_justification?: string | null
          engagement_score?: number | null
          gatekeeper_handling_score?: number | null
          gatekeeper_info_gathered?: Json | null
          gatekeeper_name?: string | null
          gatekeeper_outcome?: string | null
          gatekeeper_technique_used?: string | null
          gatekeeper_title?: string | null
          id?: string
          initial_valuation_discussion?: number | null
          key_concerns?: string[] | null
          key_topics_discussed?: string[] | null
          mandatory_question_details?: Json | null
          mandatory_questions_adherence?: number | null
          mandatory_questions_asked?: Json | null
          motivation_factors?: string[] | null
          next_step_clarity_justification?: string | null
          next_step_clarity_score?: number | null
          not_interested_reason?: string | null
          objection_handling_justification?: string | null
          objection_handling_score?: number | null
          objection_resolution_rate?: number | null
          objection_to_resolution_rate?: number | null
          objections_list?: Json | null
          objections_text?: string | null
          opening_type?: string | null
          overall_quality_score?: number | null
          owner_name_confirmed?: string | null
          personal_insights?: string | null
          quality_of_conversation_justification?: string | null
          quality_of_conversation_score?: number | null
          rapport_building_justification?: string | null
          rapport_building_score?: number | null
          referral_generation_rate?: number | null
          scoring_model?: string | null
          script_adherence_justification?: string | null
          script_adherence_score?: number | null
          seller_interest_justification?: string | null
          seller_interest_score?: number | null
          timeline_months?: number | null
          timeline_to_sell?: string | null
          transcript_id?: string | null
          trigger_events?: Json | null
          valuation_discussion_justification?: string | null
          valuation_discussion_score?: number | null
          valuation_multiple?: number | null
          value_proposition_justification?: string | null
          value_proposition_score?: number | null
          workspace_id: string
          wrong_number_flag?: boolean | null
          wrong_number_notes?: string | null
          wrong_number_type?: string | null
        }
        Update: {
          best_time_to_call?: string | null
          buyer_type_preference?: string | null
          call_category?: string | null
          call_id?: string
          clarity_of_value_proposition_justification?: string | null
          clarity_of_value_proposition_score?: number | null
          composite_score?: number | null
          correct_info_obtained?: boolean | null
          created_at?: string
          data_source?: string | null
          decision_maker_identification?: number | null
          direct_line_obtained?: string | null
          engagement_justification?: string | null
          engagement_score?: number | null
          gatekeeper_handling_score?: number | null
          gatekeeper_info_gathered?: Json | null
          gatekeeper_name?: string | null
          gatekeeper_outcome?: string | null
          gatekeeper_technique_used?: string | null
          gatekeeper_title?: string | null
          id?: string
          initial_valuation_discussion?: number | null
          key_concerns?: string[] | null
          key_topics_discussed?: string[] | null
          mandatory_question_details?: Json | null
          mandatory_questions_adherence?: number | null
          mandatory_questions_asked?: Json | null
          motivation_factors?: string[] | null
          next_step_clarity_justification?: string | null
          next_step_clarity_score?: number | null
          not_interested_reason?: string | null
          objection_handling_justification?: string | null
          objection_handling_score?: number | null
          objection_resolution_rate?: number | null
          objection_to_resolution_rate?: number | null
          objections_list?: Json | null
          objections_text?: string | null
          opening_type?: string | null
          overall_quality_score?: number | null
          owner_name_confirmed?: string | null
          personal_insights?: string | null
          quality_of_conversation_justification?: string | null
          quality_of_conversation_score?: number | null
          rapport_building_justification?: string | null
          rapport_building_score?: number | null
          referral_generation_rate?: number | null
          scoring_model?: string | null
          script_adherence_justification?: string | null
          script_adherence_score?: number | null
          seller_interest_justification?: string | null
          seller_interest_score?: number | null
          timeline_months?: number | null
          timeline_to_sell?: string | null
          transcript_id?: string | null
          trigger_events?: Json | null
          valuation_discussion_justification?: string | null
          valuation_discussion_score?: number | null
          valuation_multiple?: number | null
          value_proposition_justification?: string | null
          value_proposition_score?: number | null
          workspace_id?: string
          wrong_number_flag?: boolean | null
          wrong_number_notes?: string | null
          wrong_number_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_ai_scores_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "phoneburner_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_ai_scores_transcript_id_fkey"
            columns: ["transcript_id"]
            isOneToOne: false
            referencedRelation: "call_transcripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_ai_scores_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      call_library_categories: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_system: boolean | null
          name: string
          slug: string
          use_case: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_system?: boolean | null
          name: string
          slug: string
          use_case?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_system?: boolean | null
          name?: string
          slug?: string
          use_case?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_library_categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      call_library_entries: {
        Row: {
          added_by: string
          call_id: string
          category: string
          created_at: string
          description: string | null
          highlight_end_time: number | null
          highlight_start_time: number | null
          id: string
          tags: string[] | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          added_by: string
          call_id: string
          category: string
          created_at?: string
          description?: string | null
          highlight_end_time?: number | null
          highlight_start_time?: number | null
          id?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          added_by?: string
          call_id?: string
          category?: string
          created_at?: string
          description?: string | null
          highlight_end_time?: number | null
          highlight_start_time?: number | null
          id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_library_entries_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "phoneburner_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_library_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      call_summaries: {
        Row: {
          call_id: string
          created_at: string
          followup_due_date: string | null
          followup_task_name: string | null
          id: string
          is_followup_completed: boolean | null
          summary: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          call_id: string
          created_at?: string
          followup_due_date?: string | null
          followup_task_name?: string | null
          id?: string
          is_followup_completed?: boolean | null
          summary?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          call_id?: string
          created_at?: string
          followup_due_date?: string | null
          followup_task_name?: string | null
          id?: string
          is_followup_completed?: boolean | null
          summary?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_summaries_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "phoneburner_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_summaries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      call_transcripts: {
        Row: {
          call_id: string
          completed_at: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          speaker_segments: Json | null
          transcript_text: string | null
          transcription_error: string | null
          transcription_status: string
          word_count: number | null
          workspace_id: string
        }
        Insert: {
          call_id: string
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          speaker_segments?: Json | null
          transcript_text?: string | null
          transcription_error?: string | null
          transcription_status?: string
          word_count?: number | null
          workspace_id: string
        }
        Update: {
          call_id?: string
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          speaker_segments?: Json | null
          transcript_text?: string | null
          transcription_error?: string | null
          transcription_status?: string
          word_count?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_transcripts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "phoneburner_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transcripts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      calling_deals: {
        Row: {
          annual_revenue_raw: number | null
          business_description: string | null
          business_history: string | null
          buyer_preferences: string | null
          company_name: string
          company_size_score: number | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_title: string | null
          created_at: string | null
          created_by: string | null
          ebitda_raw: number | null
          employees: number | null
          engagement_id: string | null
          exit_reason: string | null
          financial_data: string | null
          future_growth_plans: string | null
          growth_information: string | null
          id: string
          industry: string | null
          interest_level: string | null
          key_concerns: string[] | null
          key_points: string | null
          last_contact_at: string | null
          lead_id: string | null
          location: string | null
          ma_discussions: string | null
          mobile_number: string | null
          motivation_factors: string[] | null
          motivation_score: number | null
          next_action: string | null
          next_action_date: string | null
          ownership_details: string | null
          ownership_information: string | null
          revenue: number | null
          revenue_ebitda_history: string | null
          seller_interest_score: number | null
          seller_interest_summary: string | null
          status: string | null
          target_pain_points: string | null
          timeline_score: number | null
          timeline_to_sell: string | null
          total_deal_score: number | null
          transaction_goals: string | null
          updated_at: string | null
          valuation_expectations: string | null
          workspace_id: string
        }
        Insert: {
          annual_revenue_raw?: number | null
          business_description?: string | null
          business_history?: string | null
          buyer_preferences?: string | null
          company_name: string
          company_size_score?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_title?: string | null
          created_at?: string | null
          created_by?: string | null
          ebitda_raw?: number | null
          employees?: number | null
          engagement_id?: string | null
          exit_reason?: string | null
          financial_data?: string | null
          future_growth_plans?: string | null
          growth_information?: string | null
          id?: string
          industry?: string | null
          interest_level?: string | null
          key_concerns?: string[] | null
          key_points?: string | null
          last_contact_at?: string | null
          lead_id?: string | null
          location?: string | null
          ma_discussions?: string | null
          mobile_number?: string | null
          motivation_factors?: string[] | null
          motivation_score?: number | null
          next_action?: string | null
          next_action_date?: string | null
          ownership_details?: string | null
          ownership_information?: string | null
          revenue?: number | null
          revenue_ebitda_history?: string | null
          seller_interest_score?: number | null
          seller_interest_summary?: string | null
          status?: string | null
          target_pain_points?: string | null
          timeline_score?: number | null
          timeline_to_sell?: string | null
          total_deal_score?: number | null
          transaction_goals?: string | null
          updated_at?: string | null
          valuation_expectations?: string | null
          workspace_id: string
        }
        Update: {
          annual_revenue_raw?: number | null
          business_description?: string | null
          business_history?: string | null
          buyer_preferences?: string | null
          company_name?: string
          company_size_score?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_title?: string | null
          created_at?: string | null
          created_by?: string | null
          ebitda_raw?: number | null
          employees?: number | null
          engagement_id?: string | null
          exit_reason?: string | null
          financial_data?: string | null
          future_growth_plans?: string | null
          growth_information?: string | null
          id?: string
          industry?: string | null
          interest_level?: string | null
          key_concerns?: string[] | null
          key_points?: string | null
          last_contact_at?: string | null
          lead_id?: string | null
          location?: string | null
          ma_discussions?: string | null
          mobile_number?: string | null
          motivation_factors?: string[] | null
          motivation_score?: number | null
          next_action?: string | null
          next_action_date?: string | null
          ownership_details?: string | null
          ownership_information?: string | null
          revenue?: number | null
          revenue_ebitda_history?: string | null
          seller_interest_score?: number | null
          seller_interest_summary?: string | null
          status?: string | null
          target_pain_points?: string | null
          timeline_score?: number | null
          timeline_to_sell?: string | null
          total_deal_score?: number | null
          transaction_goals?: string | null
          updated_at?: string | null
          valuation_expectations?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calling_deals_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calling_deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "contact_engagement_summary"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "calling_deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calling_deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          analyst: string | null
          called_at: string | null
          category: string | null
          composite_score: number | null
          contact_company: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          direction: string | null
          duration_seconds: number | null
          engagement_score: number | null
          external_id: string | null
          gatekeeper_score: number | null
          id: string
          key_concerns: string[] | null
          next_step_score: number | null
          objection_handling_score: number | null
          opening_type: string | null
          platform: string
          primary_opportunity: string | null
          quality_score: number | null
          rapport_score: number | null
          recording_url: string | null
          salesforce_url: string | null
          seller_interest_score: number | null
          summary: string | null
          target_pain_points: string | null
          transcript: string | null
          updated_at: string | null
          value_proposition_score: number | null
          workspace_id: string
        }
        Insert: {
          analyst?: string | null
          called_at?: string | null
          category?: string | null
          composite_score?: number | null
          contact_company?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          direction?: string | null
          duration_seconds?: number | null
          engagement_score?: number | null
          external_id?: string | null
          gatekeeper_score?: number | null
          id?: string
          key_concerns?: string[] | null
          next_step_score?: number | null
          objection_handling_score?: number | null
          opening_type?: string | null
          platform: string
          primary_opportunity?: string | null
          quality_score?: number | null
          rapport_score?: number | null
          recording_url?: string | null
          salesforce_url?: string | null
          seller_interest_score?: number | null
          summary?: string | null
          target_pain_points?: string | null
          transcript?: string | null
          updated_at?: string | null
          value_proposition_score?: number | null
          workspace_id: string
        }
        Update: {
          analyst?: string | null
          called_at?: string | null
          category?: string | null
          composite_score?: number | null
          contact_company?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          direction?: string | null
          duration_seconds?: number | null
          engagement_score?: number | null
          external_id?: string | null
          gatekeeper_score?: number | null
          id?: string
          key_concerns?: string[] | null
          next_step_score?: number | null
          objection_handling_score?: number | null
          opening_type?: string | null
          platform?: string
          primary_opportunity?: string | null
          quality_score?: number | null
          rapport_score?: number | null
          recording_url?: string | null
          salesforce_url?: string | null
          seller_interest_score?: number | null
          summary?: string | null
          target_pain_points?: string | null
          transcript?: string | null
          updated_at?: string | null
          value_proposition_score?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_cumulative: {
        Row: {
          baseline_bounced: number | null
          baseline_clicked: number | null
          baseline_opened: number | null
          baseline_replied: number | null
          baseline_sent: number | null
          campaign_id: string
          created_at: string | null
          first_synced_at: string | null
          id: string
          last_synced_at: string | null
          total_bounced: number | null
          total_clicked: number | null
          total_opened: number | null
          total_positive_replies: number | null
          total_replied: number | null
          total_sent: number | null
          total_unsubscribed: number | null
          workspace_id: string
        }
        Insert: {
          baseline_bounced?: number | null
          baseline_clicked?: number | null
          baseline_opened?: number | null
          baseline_replied?: number | null
          baseline_sent?: number | null
          campaign_id: string
          created_at?: string | null
          first_synced_at?: string | null
          id?: string
          last_synced_at?: string | null
          total_bounced?: number | null
          total_clicked?: number | null
          total_opened?: number | null
          total_positive_replies?: number | null
          total_replied?: number | null
          total_sent?: number | null
          total_unsubscribed?: number | null
          workspace_id: string
        }
        Update: {
          baseline_bounced?: number | null
          baseline_clicked?: number | null
          baseline_opened?: number | null
          baseline_replied?: number | null
          baseline_sent?: number | null
          campaign_id?: string
          created_at?: string | null
          first_synced_at?: string | null
          id?: string
          last_synced_at?: string | null
          total_bounced?: number | null
          total_clicked?: number | null
          total_opened?: number | null
          total_positive_replies?: number | null
          total_replied?: number | null
          total_sent?: number | null
          total_unsubscribed?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_cumulative_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "unified_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_cumulative_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_metrics: {
        Row: {
          bounced_count: number | null
          campaign_id: string
          clicked_count: number | null
          created_at: string | null
          id: string
          metric_date: string
          opened_count: number | null
          positive_reply_count: number | null
          replied_count: number | null
          sent_count: number | null
          unsubscribed_count: number | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          bounced_count?: number | null
          campaign_id: string
          clicked_count?: number | null
          created_at?: string | null
          id?: string
          metric_date: string
          opened_count?: number | null
          positive_reply_count?: number | null
          replied_count?: number | null
          sent_count?: number | null
          unsubscribed_count?: number | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          bounced_count?: number | null
          campaign_id?: string
          clicked_count?: number | null
          created_at?: string | null
          id?: string
          metric_date?: string
          opened_count?: number | null
          positive_reply_count?: number | null
          replied_count?: number | null
          sent_count?: number | null
          unsubscribed_count?: number | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "unified_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_metrics_workspace_id_fkey"
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
      campaign_variant_metrics: {
        Row: {
          bounced_count: number | null
          campaign_id: string
          clicked_count: number | null
          created_at: string | null
          id: string
          metric_date: string
          opened_count: number | null
          replied_count: number | null
          sent_count: number | null
          variant_id: string
          workspace_id: string
        }
        Insert: {
          bounced_count?: number | null
          campaign_id: string
          clicked_count?: number | null
          created_at?: string | null
          id?: string
          metric_date: string
          opened_count?: number | null
          replied_count?: number | null
          sent_count?: number | null
          variant_id: string
          workspace_id: string
        }
        Update: {
          bounced_count?: number | null
          campaign_id?: string
          clicked_count?: number | null
          created_at?: string | null
          id?: string
          metric_date?: string
          opened_count?: number | null
          replied_count?: number | null
          sent_count?: number | null
          variant_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_variant_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "unified_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_variant_metrics_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "unified_campaign_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_variant_metrics_workspace_id_fkey"
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
      channel_best_practices: {
        Row: {
          category: string
          channel: string
          config: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          performance_lift: number | null
          practice_type: string
          source: string | null
          updated_at: string
        }
        Insert: {
          category: string
          channel: string
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          performance_lift?: number | null
          practice_type: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          channel?: string
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          performance_lift?: number | null
          practice_type?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cold_calling_benchmarks: {
        Row: {
          benchmark_range_high: number | null
          benchmark_range_low: number | null
          benchmark_unit: string
          benchmark_value: number
          created_at: string
          description: string | null
          id: string
          metric_key: string
          metric_name: string
          source: string | null
        }
        Insert: {
          benchmark_range_high?: number | null
          benchmark_range_low?: number | null
          benchmark_unit: string
          benchmark_value: number
          created_at?: string
          description?: string | null
          id?: string
          metric_key: string
          metric_name: string
          source?: string | null
        }
        Update: {
          benchmark_range_high?: number | null
          benchmark_range_low?: number | null
          benchmark_unit?: string
          benchmark_value?: number
          created_at?: string
          description?: string | null
          id?: string
          metric_key?: string
          metric_name?: string
          source?: string | null
        }
        Relationships: []
      }
      cold_calls: {
        Row: {
          analyst: string | null
          call_duration_sec: number | null
          call_summary: string | null
          call_transcript: string | null
          called_date: string | null
          called_date_time: string | null
          category: string | null
          composite_score: number | null
          created_at: string
          direction: string | null
          engagement_score: number | null
          from_name: string | null
          from_number: string | null
          gatekeeper_handling_score: number | null
          id: string
          key_concerns: string[] | null
          next_step_clarity_score: number | null
          nocodb_created_at: string | null
          nocodb_id: number | null
          nocodb_updated_at: string | null
          objection_handling_score: number | null
          opening_type: string | null
          primary_opportunity: string | null
          quality_of_conversation_score: number | null
          rapport_building_score: number | null
          salesforce_url: string | null
          seller_interest_score: number | null
          target_pain_points: string | null
          to_company: string | null
          to_email: string | null
          to_name: string | null
          to_number: string | null
          updated_at: string
          value_proposition_score: number | null
          workspace_id: string
        }
        Insert: {
          analyst?: string | null
          call_duration_sec?: number | null
          call_summary?: string | null
          call_transcript?: string | null
          called_date?: string | null
          called_date_time?: string | null
          category?: string | null
          composite_score?: number | null
          created_at?: string
          direction?: string | null
          engagement_score?: number | null
          from_name?: string | null
          from_number?: string | null
          gatekeeper_handling_score?: number | null
          id?: string
          key_concerns?: string[] | null
          next_step_clarity_score?: number | null
          nocodb_created_at?: string | null
          nocodb_id?: number | null
          nocodb_updated_at?: string | null
          objection_handling_score?: number | null
          opening_type?: string | null
          primary_opportunity?: string | null
          quality_of_conversation_score?: number | null
          rapport_building_score?: number | null
          salesforce_url?: string | null
          seller_interest_score?: number | null
          target_pain_points?: string | null
          to_company?: string | null
          to_email?: string | null
          to_name?: string | null
          to_number?: string | null
          updated_at?: string
          value_proposition_score?: number | null
          workspace_id: string
        }
        Update: {
          analyst?: string | null
          call_duration_sec?: number | null
          call_summary?: string | null
          call_transcript?: string | null
          called_date?: string | null
          called_date_time?: string | null
          category?: string | null
          composite_score?: number | null
          created_at?: string
          direction?: string | null
          engagement_score?: number | null
          from_name?: string | null
          from_number?: string | null
          gatekeeper_handling_score?: number | null
          id?: string
          key_concerns?: string[] | null
          next_step_clarity_score?: number | null
          nocodb_created_at?: string | null
          nocodb_id?: number | null
          nocodb_updated_at?: string | null
          objection_handling_score?: number | null
          opening_type?: string | null
          primary_opportunity?: string | null
          quality_of_conversation_score?: number | null
          rapport_building_score?: number | null
          salesforce_url?: string | null
          seller_interest_score?: number | null
          target_pain_points?: string | null
          to_company?: string | null
          to_email?: string | null
          to_name?: string | null
          to_number?: string | null
          updated_at?: string
          value_proposition_score?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cold_calls_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_notes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          lead_id: string
          note_text: string
          note_type: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          lead_id: string
          note_text: string
          note_type?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string
          note_text?: string
          note_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "contact_engagement_summary"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "contact_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_generation_sessions: {
        Row: {
          channel: string
          company_context: string | null
          created_at: string
          created_by: string
          generated_variations: Json | null
          id: string
          selected_variation_index: number | null
          sequence_step: string
          specific_instructions: string | null
          target_industry: string | null
          target_persona: string | null
          tone: string | null
          trigger_event: string | null
          workspace_id: string
        }
        Insert: {
          channel: string
          company_context?: string | null
          created_at?: string
          created_by: string
          generated_variations?: Json | null
          id?: string
          selected_variation_index?: number | null
          sequence_step: string
          specific_instructions?: string | null
          target_industry?: string | null
          target_persona?: string | null
          tone?: string | null
          trigger_event?: string | null
          workspace_id: string
        }
        Update: {
          channel?: string
          company_context?: string | null
          created_at?: string
          created_by?: string
          generated_variations?: Json | null
          id?: string
          selected_variation_index?: number | null
          sequence_step?: string
          specific_instructions?: string | null
          target_industry?: string | null
          target_persona?: string | null
          tone?: string | null
          trigger_event?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copy_generation_sessions_workspace_id_fkey"
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
      deliverability_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          id: string
          is_read: boolean | null
          is_resolved: boolean | null
          message: string
          metric_value: number | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          threshold_value: number | null
          title: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          is_resolved?: boolean | null
          message: string
          metric_value?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          threshold_value?: number | null
          title: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          is_resolved?: boolean | null
          message?: string
          metric_value?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          threshold_value?: number | null
          title?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliverability_alerts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          account_status: string | null
          bounce_rate: number | null
          created_at: string
          daily_limit: number | null
          email_address: string
          health_score: number | null
          id: string
          is_active: boolean
          platform: string
          platform_id: string
          reply_rate: number | null
          sender_name: string | null
          sent_30d: number | null
          spam_complaint_rate: number | null
          updated_at: string
          warmup_enabled: boolean | null
          warmup_percentage: number | null
          warmup_start_date: string | null
          warmup_status: string | null
          workspace_id: string
        }
        Insert: {
          account_status?: string | null
          bounce_rate?: number | null
          created_at?: string
          daily_limit?: number | null
          email_address: string
          health_score?: number | null
          id?: string
          is_active?: boolean
          platform: string
          platform_id: string
          reply_rate?: number | null
          sender_name?: string | null
          sent_30d?: number | null
          spam_complaint_rate?: number | null
          updated_at?: string
          warmup_enabled?: boolean | null
          warmup_percentage?: number | null
          warmup_start_date?: string | null
          warmup_status?: string | null
          workspace_id: string
        }
        Update: {
          account_status?: string | null
          bounce_rate?: number | null
          created_at?: string
          daily_limit?: number | null
          email_address?: string
          health_score?: number | null
          id?: string
          is_active?: boolean
          platform?: string
          platform_id?: string
          reply_rate?: number | null
          sender_name?: string | null
          sent_30d?: number | null
          spam_complaint_rate?: number | null
          updated_at?: string
          warmup_enabled?: boolean | null
          warmup_percentage?: number | null
          warmup_start_date?: string | null
          warmup_status?: string | null
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
      engagement_daily_metrics: {
        Row: {
          avg_ai_score: number | null
          connects: number | null
          conversations: number | null
          created_at: string | null
          date: string
          dials: number | null
          engagement_id: string
          id: string
          meetings_set: number | null
          rep_profile_id: string | null
          talk_time_seconds: number | null
          voicemails: number | null
        }
        Insert: {
          avg_ai_score?: number | null
          connects?: number | null
          conversations?: number | null
          created_at?: string | null
          date: string
          dials?: number | null
          engagement_id: string
          id?: string
          meetings_set?: number | null
          rep_profile_id?: string | null
          talk_time_seconds?: number | null
          voicemails?: number | null
        }
        Update: {
          avg_ai_score?: number | null
          connects?: number | null
          conversations?: number | null
          created_at?: string | null
          date?: string
          dials?: number | null
          engagement_id?: string
          id?: string
          meetings_set?: number | null
          rep_profile_id?: string | null
          talk_time_seconds?: number | null
          voicemails?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "engagement_daily_metrics_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_daily_metrics_rep_profile_id_fkey"
            columns: ["rep_profile_id"]
            isOneToOne: false
            referencedRelation: "rep_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_reps: {
        Row: {
          assigned_at: string | null
          engagement_id: string
          id: string
          rep_profile_id: string
        }
        Insert: {
          assigned_at?: string | null
          engagement_id: string
          id?: string
          rep_profile_id: string
        }
        Update: {
          assigned_at?: string | null
          engagement_id?: string
          id?: string
          rep_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_reps_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_reps_rep_profile_id_fkey"
            columns: ["rep_profile_id"]
            isOneToOne: false
            referencedRelation: "rep_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engagements: {
        Row: {
          analyst: string | null
          associate_vp: string | null
          client_name: string
          connect_rate_target: number | null
          created_at: string | null
          created_by: string | null
          deal_lead: string | null
          end_date: string | null
          engagement_name: string
          geography: string | null
          id: string
          industry_focus: string | null
          meeting_rate_target: number | null
          meetings_target: number | null
          notes: string | null
          pipeline_value_target: number | null
          priority: string | null
          revenue_max: number | null
          revenue_min: number | null
          sponsor: string | null
          start_date: string
          status: string | null
          total_calls_target: number | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          analyst?: string | null
          associate_vp?: string | null
          client_name: string
          connect_rate_target?: number | null
          created_at?: string | null
          created_by?: string | null
          deal_lead?: string | null
          end_date?: string | null
          engagement_name: string
          geography?: string | null
          id?: string
          industry_focus?: string | null
          meeting_rate_target?: number | null
          meetings_target?: number | null
          notes?: string | null
          pipeline_value_target?: number | null
          priority?: string | null
          revenue_max?: number | null
          revenue_min?: number | null
          sponsor?: string | null
          start_date: string
          status?: string | null
          total_calls_target?: number | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          analyst?: string | null
          associate_vp?: string | null
          client_name?: string
          connect_rate_target?: number | null
          created_at?: string | null
          created_by?: string | null
          deal_lead?: string | null
          end_date?: string | null
          engagement_name?: string
          geography?: string | null
          id?: string
          industry_focus?: string | null
          meeting_rate_target?: number | null
          meetings_target?: number | null
          notes?: string | null
          pipeline_value_target?: number | null
          priority?: string | null
          revenue_max?: number | null
          revenue_min?: number | null
          sponsor?: string | null
          start_date?: string
          status?: string | null
          total_calls_target?: number | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagements_workspace_id_fkey"
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
      external_calls: {
        Row: {
          all_participants: string | null
          annual_revenue: string | null
          business_description: string | null
          business_history: string | null
          buyer_type_preference: string | null
          call_category: string | null
          call_date: string | null
          call_direction: string | null
          call_summary: string | null
          call_title: string | null
          call_type: string | null
          company_name: string | null
          composite_score: number | null
          contact_name: string | null
          conversation_quality_justification: string | null
          created_at: string | null
          date_time: string | null
          decision_maker_justification: string | null
          decision_maker_score: number | null
          duration: number | null
          ebitda: string | null
          employee_count: number | null
          engagement_name: string | null
          engagement_score: number | null
          error_message: string | null
          exit_reason: string | null
          financial_data: string | null
          fireflies_url: string | null
          from_number: string | null
          future_growth_plans: string | null
          growth_information: string | null
          historical_financials: string | null
          host_email: string | null
          id: string
          import_status: string | null
          interest_in_selling: string | null
          key_concerns: string[] | null
          key_topics_discussed: string[] | null
          ma_discussions: string | null
          mobile_number: string | null
          motivation_factors: string[] | null
          next_step_clarity_justification: string | null
          next_step_clarity_score: number | null
          nocodb_created_at: string | null
          nocodb_row_id: string | null
          nocodb_updated_at: string | null
          not_interested_reason: string | null
          objection_handling_justification: string | null
          objection_handling_score: number | null
          objection_resolution_rate: number | null
          objections_count: number | null
          objections_list: Json | null
          objections_list_text: string | null
          objections_resolved_count: number | null
          opening_type: string | null
          overall_quality_justification: string | null
          overall_quality_score: number | null
          ownership_details: string | null
          ownership_information: string | null
          personal_insights: string | null
          personal_insights_justification: string | null
          personal_insights_score: number | null
          phoneburner_recording_url: string | null
          quality_of_conversation_score: number | null
          question_adherence_justification: string | null
          question_adherence_score: number | null
          questions_covered_count: number | null
          rapport_building_justification: string | null
          rapport_building_score: number | null
          referral_rate_justification: string | null
          referral_rate_score: number | null
          rep_name: string | null
          resolution_rate_justification: string | null
          salesforce_url: string | null
          script_adherence_justification: string | null
          script_adherence_score: number | null
          seller_interest_justification: string | null
          seller_interest_score: number | null
          target_pain_points: string | null
          timeline_to_sell: string | null
          to_number: string | null
          transaction_goals: string | null
          transcript_text: string | null
          updated_at: string | null
          valuation_discussion_justification: string | null
          valuation_discussion_score: number | null
          valuation_expectations: string | null
          value_proposition_justification: string | null
          value_proposition_score: number | null
          workspace_id: string
        }
        Insert: {
          all_participants?: string | null
          annual_revenue?: string | null
          business_description?: string | null
          business_history?: string | null
          buyer_type_preference?: string | null
          call_category?: string | null
          call_date?: string | null
          call_direction?: string | null
          call_summary?: string | null
          call_title?: string | null
          call_type?: string | null
          company_name?: string | null
          composite_score?: number | null
          contact_name?: string | null
          conversation_quality_justification?: string | null
          created_at?: string | null
          date_time?: string | null
          decision_maker_justification?: string | null
          decision_maker_score?: number | null
          duration?: number | null
          ebitda?: string | null
          employee_count?: number | null
          engagement_name?: string | null
          engagement_score?: number | null
          error_message?: string | null
          exit_reason?: string | null
          financial_data?: string | null
          fireflies_url?: string | null
          from_number?: string | null
          future_growth_plans?: string | null
          growth_information?: string | null
          historical_financials?: string | null
          host_email?: string | null
          id?: string
          import_status?: string | null
          interest_in_selling?: string | null
          key_concerns?: string[] | null
          key_topics_discussed?: string[] | null
          ma_discussions?: string | null
          mobile_number?: string | null
          motivation_factors?: string[] | null
          next_step_clarity_justification?: string | null
          next_step_clarity_score?: number | null
          nocodb_created_at?: string | null
          nocodb_row_id?: string | null
          nocodb_updated_at?: string | null
          not_interested_reason?: string | null
          objection_handling_justification?: string | null
          objection_handling_score?: number | null
          objection_resolution_rate?: number | null
          objections_count?: number | null
          objections_list?: Json | null
          objections_list_text?: string | null
          objections_resolved_count?: number | null
          opening_type?: string | null
          overall_quality_justification?: string | null
          overall_quality_score?: number | null
          ownership_details?: string | null
          ownership_information?: string | null
          personal_insights?: string | null
          personal_insights_justification?: string | null
          personal_insights_score?: number | null
          phoneburner_recording_url?: string | null
          quality_of_conversation_score?: number | null
          question_adherence_justification?: string | null
          question_adherence_score?: number | null
          questions_covered_count?: number | null
          rapport_building_justification?: string | null
          rapport_building_score?: number | null
          referral_rate_justification?: string | null
          referral_rate_score?: number | null
          rep_name?: string | null
          resolution_rate_justification?: string | null
          salesforce_url?: string | null
          script_adherence_justification?: string | null
          script_adherence_score?: number | null
          seller_interest_justification?: string | null
          seller_interest_score?: number | null
          target_pain_points?: string | null
          timeline_to_sell?: string | null
          to_number?: string | null
          transaction_goals?: string | null
          transcript_text?: string | null
          updated_at?: string | null
          valuation_discussion_justification?: string | null
          valuation_discussion_score?: number | null
          valuation_expectations?: string | null
          value_proposition_justification?: string | null
          value_proposition_score?: number | null
          workspace_id: string
        }
        Update: {
          all_participants?: string | null
          annual_revenue?: string | null
          business_description?: string | null
          business_history?: string | null
          buyer_type_preference?: string | null
          call_category?: string | null
          call_date?: string | null
          call_direction?: string | null
          call_summary?: string | null
          call_title?: string | null
          call_type?: string | null
          company_name?: string | null
          composite_score?: number | null
          contact_name?: string | null
          conversation_quality_justification?: string | null
          created_at?: string | null
          date_time?: string | null
          decision_maker_justification?: string | null
          decision_maker_score?: number | null
          duration?: number | null
          ebitda?: string | null
          employee_count?: number | null
          engagement_name?: string | null
          engagement_score?: number | null
          error_message?: string | null
          exit_reason?: string | null
          financial_data?: string | null
          fireflies_url?: string | null
          from_number?: string | null
          future_growth_plans?: string | null
          growth_information?: string | null
          historical_financials?: string | null
          host_email?: string | null
          id?: string
          import_status?: string | null
          interest_in_selling?: string | null
          key_concerns?: string[] | null
          key_topics_discussed?: string[] | null
          ma_discussions?: string | null
          mobile_number?: string | null
          motivation_factors?: string[] | null
          next_step_clarity_justification?: string | null
          next_step_clarity_score?: number | null
          nocodb_created_at?: string | null
          nocodb_row_id?: string | null
          nocodb_updated_at?: string | null
          not_interested_reason?: string | null
          objection_handling_justification?: string | null
          objection_handling_score?: number | null
          objection_resolution_rate?: number | null
          objections_count?: number | null
          objections_list?: Json | null
          objections_list_text?: string | null
          objections_resolved_count?: number | null
          opening_type?: string | null
          overall_quality_justification?: string | null
          overall_quality_score?: number | null
          ownership_details?: string | null
          ownership_information?: string | null
          personal_insights?: string | null
          personal_insights_justification?: string | null
          personal_insights_score?: number | null
          phoneburner_recording_url?: string | null
          quality_of_conversation_score?: number | null
          question_adherence_justification?: string | null
          question_adherence_score?: number | null
          questions_covered_count?: number | null
          rapport_building_justification?: string | null
          rapport_building_score?: number | null
          referral_rate_justification?: string | null
          referral_rate_score?: number | null
          rep_name?: string | null
          resolution_rate_justification?: string | null
          salesforce_url?: string | null
          script_adherence_justification?: string | null
          script_adherence_score?: number | null
          seller_interest_justification?: string | null
          seller_interest_score?: number | null
          target_pain_points?: string | null
          timeline_to_sell?: string | null
          to_number?: string | null
          transaction_goals?: string | null
          transcript_text?: string | null
          updated_at?: string | null
          valuation_discussion_justification?: string | null
          valuation_discussion_score?: number | null
          valuation_expectations?: string | null
          value_proposition_justification?: string | null
          value_proposition_score?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_calls_workspace_id_fkey"
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
      industry_intelligence: {
        Row: {
          content: string
          context: string | null
          created_at: string
          created_by: string | null
          id: string
          industry: string
          intel_type: string
          is_global: boolean | null
          source_document: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          content: string
          context?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry: string
          intel_type: string
          is_global?: boolean | null
          source_document?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          content?: string
          context?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string
          intel_type?: string
          is_global?: boolean | null
          source_document?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "industry_intelligence_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_call_attempts: {
        Row: {
          attempt_count: number
          first_attempt_at: string
          id: string
          last_attempt_at: string
          lead_id: string
          outcome: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attempt_count?: number
          first_attempt_at?: string
          id?: string
          last_attempt_at?: string
          lead_id: string
          outcome?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attempt_count?: number
          first_attempt_at?: string
          id?: string
          last_attempt_at?: string
          lead_id?: string
          outcome?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_call_attempts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "contact_engagement_summary"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_call_attempts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_call_attempts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          campaign_id: string | null
          category: string | null
          company: string | null
          company_size: string | null
          company_size_category: string | null
          contact_status: string | null
          created_at: string
          department: string | null
          do_not_call: boolean | null
          do_not_email: boolean | null
          email: string
          email_domain: string | null
          email_type: string | null
          enriched_at: string | null
          first_name: string | null
          id: string
          industry: string | null
          last_call_at: string | null
          last_contact_at: string | null
          last_email_at: string | null
          last_name: string | null
          lead_source: string | null
          linkedin_url: string | null
          location: string | null
          next_action_date: string | null
          next_action_type: string | null
          phone_number: string | null
          phoneburner_contact_id: string | null
          platform: string
          platform_lead_id: string | null
          seller_interest_score: number | null
          seller_interest_summary: string | null
          seniority_level: string | null
          status: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
          website: string | null
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          category?: string | null
          company?: string | null
          company_size?: string | null
          company_size_category?: string | null
          contact_status?: string | null
          created_at?: string
          department?: string | null
          do_not_call?: boolean | null
          do_not_email?: boolean | null
          email: string
          email_domain?: string | null
          email_type?: string | null
          enriched_at?: string | null
          first_name?: string | null
          id?: string
          industry?: string | null
          last_call_at?: string | null
          last_contact_at?: string | null
          last_email_at?: string | null
          last_name?: string | null
          lead_source?: string | null
          linkedin_url?: string | null
          location?: string | null
          next_action_date?: string | null
          next_action_type?: string | null
          phone_number?: string | null
          phoneburner_contact_id?: string | null
          platform: string
          platform_lead_id?: string | null
          seller_interest_score?: number | null
          seller_interest_summary?: string | null
          seniority_level?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          website?: string | null
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          category?: string | null
          company?: string | null
          company_size?: string | null
          company_size_category?: string | null
          contact_status?: string | null
          created_at?: string
          department?: string | null
          do_not_call?: boolean | null
          do_not_email?: boolean | null
          email?: string
          email_domain?: string | null
          email_type?: string | null
          enriched_at?: string | null
          first_name?: string | null
          id?: string
          industry?: string | null
          last_call_at?: string | null
          last_contact_at?: string | null
          last_email_at?: string | null
          last_name?: string | null
          lead_source?: string | null
          linkedin_url?: string | null
          location?: string | null
          next_action_date?: string | null
          next_action_type?: string | null
          phone_number?: string | null
          phoneburner_contact_id?: string | null
          platform?: string
          platform_lead_id?: string | null
          seller_interest_score?: number | null
          seller_interest_summary?: string | null
          seniority_level?: string | null
          status?: string | null
          tags?: string[] | null
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
      mandatory_questions: {
        Row: {
          category: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          question_number: number
          question_text: string
          workspace_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          question_number: number
          question_text: string
          workspace_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          question_number?: number
          question_text?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mandatory_questions_workspace_id_fkey"
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
            referencedRelation: "contact_engagement_summary"
            referencedColumns: ["lead_id"]
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
      phoneburner_calls: {
        Row: {
          activity_date: string | null
          contact_id: string | null
          created_at: string
          dial_session_id: string | null
          disposition: string | null
          disposition_id: string | null
          duration_seconds: number | null
          email_sent: boolean | null
          end_at: string | null
          external_call_id: string
          external_contact_id: string | null
          id: string
          is_connected: boolean | null
          is_voicemail: boolean | null
          notes: string | null
          phone_number: string | null
          recording_url: string | null
          start_at: string | null
          updated_at: string
          voicemail_sent: string | null
          workspace_id: string
        }
        Insert: {
          activity_date?: string | null
          contact_id?: string | null
          created_at?: string
          dial_session_id?: string | null
          disposition?: string | null
          disposition_id?: string | null
          duration_seconds?: number | null
          email_sent?: boolean | null
          end_at?: string | null
          external_call_id: string
          external_contact_id?: string | null
          id?: string
          is_connected?: boolean | null
          is_voicemail?: boolean | null
          notes?: string | null
          phone_number?: string | null
          recording_url?: string | null
          start_at?: string | null
          updated_at?: string
          voicemail_sent?: string | null
          workspace_id: string
        }
        Update: {
          activity_date?: string | null
          contact_id?: string | null
          created_at?: string
          dial_session_id?: string | null
          disposition?: string | null
          disposition_id?: string | null
          duration_seconds?: number | null
          email_sent?: boolean | null
          end_at?: string | null
          external_call_id?: string
          external_contact_id?: string | null
          id?: string
          is_connected?: boolean | null
          is_voicemail?: boolean | null
          notes?: string | null
          phone_number?: string | null
          recording_url?: string | null
          start_at?: string | null
          updated_at?: string
          voicemail_sent?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phoneburner_calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_engagement_summary"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "phoneburner_calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phoneburner_calls_dial_session_id_fkey"
            columns: ["dial_session_id"]
            isOneToOne: false
            referencedRelation: "phoneburner_dial_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phoneburner_calls_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      phoneburner_contacts: {
        Row: {
          category_id: string | null
          company: string | null
          created_at: string
          date_added: string | null
          email: string | null
          external_contact_id: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          tags: string[] | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category_id?: string | null
          company?: string | null
          created_at?: string
          date_added?: string | null
          email?: string | null
          external_contact_id: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          tags?: string[] | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category_id?: string | null
          company?: string | null
          created_at?: string
          date_added?: string | null
          email?: string | null
          external_contact_id?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          tags?: string[] | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phoneburner_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      phoneburner_daily_metrics: {
        Row: {
          calls_connected: number | null
          created_at: string
          date: string
          decision_maker_connects: number | null
          emails_sent: number | null
          id: string
          interested_count: number | null
          meaningful_conversations: number | null
          meetings_booked: number | null
          member_id: string | null
          member_name: string | null
          not_interested_count: number | null
          qualified_opportunities: number | null
          total_calls: number | null
          total_sessions: number | null
          total_talk_time_seconds: number | null
          updated_at: string
          voicemails_left: number | null
          workspace_id: string
        }
        Insert: {
          calls_connected?: number | null
          created_at?: string
          date: string
          decision_maker_connects?: number | null
          emails_sent?: number | null
          id?: string
          interested_count?: number | null
          meaningful_conversations?: number | null
          meetings_booked?: number | null
          member_id?: string | null
          member_name?: string | null
          not_interested_count?: number | null
          qualified_opportunities?: number | null
          total_calls?: number | null
          total_sessions?: number | null
          total_talk_time_seconds?: number | null
          updated_at?: string
          voicemails_left?: number | null
          workspace_id: string
        }
        Update: {
          calls_connected?: number | null
          created_at?: string
          date?: string
          decision_maker_connects?: number | null
          emails_sent?: number | null
          id?: string
          interested_count?: number | null
          meaningful_conversations?: number | null
          meetings_booked?: number | null
          member_id?: string | null
          member_name?: string | null
          not_interested_count?: number | null
          qualified_opportunities?: number | null
          total_calls?: number | null
          total_sessions?: number | null
          total_talk_time_seconds?: number | null
          updated_at?: string
          voicemails_left?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phoneburner_daily_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      phoneburner_dial_sessions: {
        Row: {
          call_count: number | null
          caller_id: string | null
          created_at: string
          end_at: string | null
          external_session_id: string
          id: string
          member_id: string | null
          member_name: string | null
          start_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          call_count?: number | null
          caller_id?: string | null
          created_at?: string
          end_at?: string | null
          external_session_id: string
          id?: string
          member_id?: string | null
          member_name?: string | null
          start_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          call_count?: number | null
          caller_id?: string | null
          created_at?: string
          end_at?: string | null
          external_session_id?: string
          id?: string
          member_id?: string | null
          member_name?: string | null
          start_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phoneburner_dial_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      phoneburner_members: {
        Row: {
          created_at: string
          email: string | null
          external_member_id: string
          id: string
          name: string | null
          role: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          external_member_id: string
          id?: string
          name?: string | null
          role?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          external_member_id?: string
          id?: string
          name?: string | null
          role?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phoneburner_members_workspace_id_fkey"
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
      rep_goals: {
        Row: {
          created_at: string | null
          effective_from: string | null
          effective_to: string | null
          engagement_id: string | null
          goal_type: string
          id: string
          period: string | null
          rep_profile_id: string
          target_value: number
        }
        Insert: {
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          engagement_id?: string | null
          goal_type: string
          id?: string
          period?: string | null
          rep_profile_id: string
          target_value: number
        }
        Update: {
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          engagement_id?: string | null
          goal_type?: string
          id?: string
          period?: string | null
          rep_profile_id?: string
          target_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "rep_goals_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_goals_rep_profile_id_fkey"
            columns: ["rep_profile_id"]
            isOneToOne: false
            referencedRelation: "rep_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          first_name: string
          hire_date: string | null
          id: string
          is_active: boolean | null
          last_name: string
          phone: string | null
          phoneburner_member_id: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          first_name: string
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          last_name: string
          phone?: string | null
          phoneburner_member_id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string
          phone?: string | null
          phoneburner_member_id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      replyio_campaign_cumulative: {
        Row: {
          campaign_id: string
          created_at: string | null
          id: string
          last_synced_at: string | null
          total_bounced: number | null
          total_clicked: number | null
          total_interested: number | null
          total_opened: number | null
          total_replied: number | null
          total_sent: number | null
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          total_bounced?: number | null
          total_clicked?: number | null
          total_interested?: number | null
          total_opened?: number | null
          total_replied?: number | null
          total_sent?: number | null
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          total_bounced?: number | null
          total_clicked?: number | null
          total_interested?: number | null
          total_opened?: number | null
          total_replied?: number | null
          total_sent?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replyio_campaign_cumulative_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "replyio_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replyio_campaign_cumulative_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      replyio_campaigns: {
        Row: {
          created_at: string
          engagement_id: string | null
          id: string
          name: string
          platform_id: string
          status: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          engagement_id?: string | null
          id?: string
          name: string
          platform_id: string
          status?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          engagement_id?: string | null
          id?: string
          name?: string
          platform_id?: string
          status?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replyio_campaigns_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replyio_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      replyio_daily_metrics: {
        Row: {
          bounced_count: number | null
          campaign_id: string
          clicked_count: number | null
          created_at: string
          id: string
          metric_date: string
          negative_reply_count: number | null
          opened_count: number | null
          positive_reply_count: number | null
          replied_count: number | null
          sent_count: number | null
          updated_at: string
          variant_id: string | null
          workspace_id: string
        }
        Insert: {
          bounced_count?: number | null
          campaign_id: string
          clicked_count?: number | null
          created_at?: string
          id?: string
          metric_date: string
          negative_reply_count?: number | null
          opened_count?: number | null
          positive_reply_count?: number | null
          replied_count?: number | null
          sent_count?: number | null
          updated_at?: string
          variant_id?: string | null
          workspace_id: string
        }
        Update: {
          bounced_count?: number | null
          campaign_id?: string
          clicked_count?: number | null
          created_at?: string
          id?: string
          metric_date?: string
          negative_reply_count?: number | null
          opened_count?: number | null
          positive_reply_count?: number | null
          replied_count?: number | null
          sent_count?: number | null
          updated_at?: string
          variant_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replyio_daily_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "replyio_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replyio_daily_metrics_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "replyio_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replyio_daily_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      replyio_message_events: {
        Row: {
          campaign_id: string
          created_at: string
          event_timestamp: string | null
          event_type: string
          id: string
          lead_id: string | null
          message_id: string | null
          reply_sentiment: string | null
          reply_text: string | null
          variant_id: string | null
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          event_timestamp?: string | null
          event_type: string
          id?: string
          lead_id?: string | null
          message_id?: string | null
          reply_sentiment?: string | null
          reply_text?: string | null
          variant_id?: string | null
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          event_timestamp?: string | null
          event_type?: string
          id?: string
          lead_id?: string | null
          message_id?: string | null
          reply_sentiment?: string | null
          reply_text?: string | null
          variant_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replyio_message_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "replyio_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replyio_message_events_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "replyio_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replyio_message_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      replyio_sequence_steps: {
        Row: {
          campaign_id: string
          created_at: string
          delay_days: number | null
          id: string
          step_number: number
          step_type: string | null
          variant_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          delay_days?: number | null
          id?: string
          step_number: number
          step_type?: string | null
          variant_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          delay_days?: number | null
          id?: string
          step_number?: number
          step_type?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "replyio_sequence_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "replyio_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replyio_sequence_steps_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "replyio_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      replyio_variant_features: {
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
            foreignKeyName: "replyio_variant_features_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "replyio_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replyio_variant_features_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      replyio_variants: {
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
          variant_type?: string
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
            foreignKeyName: "replyio_variants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "replyio_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      replyio_workspace_daily_metrics: {
        Row: {
          bounced_count: number | null
          clicked_count: number | null
          created_at: string | null
          id: string
          metric_date: string
          opened_count: number | null
          positive_reply_count: number | null
          replied_count: number | null
          sent_count: number | null
          unsubscribed_count: number | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          bounced_count?: number | null
          clicked_count?: number | null
          created_at?: string | null
          id?: string
          metric_date: string
          opened_count?: number | null
          positive_reply_count?: number | null
          replied_count?: number | null
          sent_count?: number | null
          unsubscribed_count?: number | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          bounced_count?: number | null
          clicked_count?: number | null
          created_at?: string | null
          id?: string
          metric_date?: string
          opened_count?: number | null
          positive_reply_count?: number | null
          replied_count?: number | null
          sent_count?: number | null
          unsubscribed_count?: number | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replyio_workspace_daily_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sending_domains: {
        Row: {
          blacklist_status: string | null
          blacklisted_on: string[] | null
          bounce_rate: number | null
          created_at: string
          daily_volume_limit: number | null
          daily_volume_used: number | null
          dkim_valid: boolean | null
          dmarc_valid: boolean | null
          domain: string
          domain_age_days: number | null
          domain_status: string | null
          google_postmaster_reputation: string | null
          health_score: number | null
          id: string
          is_bulk_sender: boolean | null
          last_blacklist_check: string | null
          last_checked_at: string | null
          microsoft_snds_status: string | null
          reply_rate: number | null
          spam_complaint_rate: number | null
          spf_valid: boolean | null
          updated_at: string
          warmup_percentage: number | null
          workspace_id: string
        }
        Insert: {
          blacklist_status?: string | null
          blacklisted_on?: string[] | null
          bounce_rate?: number | null
          created_at?: string
          daily_volume_limit?: number | null
          daily_volume_used?: number | null
          dkim_valid?: boolean | null
          dmarc_valid?: boolean | null
          domain: string
          domain_age_days?: number | null
          domain_status?: string | null
          google_postmaster_reputation?: string | null
          health_score?: number | null
          id?: string
          is_bulk_sender?: boolean | null
          last_blacklist_check?: string | null
          last_checked_at?: string | null
          microsoft_snds_status?: string | null
          reply_rate?: number | null
          spam_complaint_rate?: number | null
          spf_valid?: boolean | null
          updated_at?: string
          warmup_percentage?: number | null
          workspace_id: string
        }
        Update: {
          blacklist_status?: string | null
          blacklisted_on?: string[] | null
          bounce_rate?: number | null
          created_at?: string
          daily_volume_limit?: number | null
          daily_volume_used?: number | null
          dkim_valid?: boolean | null
          dmarc_valid?: boolean | null
          domain?: string
          domain_age_days?: number | null
          domain_status?: string | null
          google_postmaster_reputation?: string | null
          health_score?: number | null
          id?: string
          is_bulk_sender?: boolean | null
          last_blacklist_check?: string | null
          last_checked_at?: string | null
          microsoft_snds_status?: string | null
          reply_rate?: number | null
          spam_complaint_rate?: number | null
          spf_valid?: boolean | null
          updated_at?: string
          warmup_percentage?: number | null
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
      smartlead_campaign_cumulative: {
        Row: {
          campaign_id: string
          created_at: string | null
          id: string
          last_synced_at: string | null
          total_bounced: number | null
          total_clicked: number | null
          total_interested: number | null
          total_opened: number | null
          total_replied: number | null
          total_sent: number | null
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          total_bounced?: number | null
          total_clicked?: number | null
          total_interested?: number | null
          total_opened?: number | null
          total_replied?: number | null
          total_sent?: number | null
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          total_bounced?: number | null
          total_clicked?: number | null
          total_interested?: number | null
          total_opened?: number | null
          total_replied?: number | null
          total_sent?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smartlead_campaign_cumulative_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "smartlead_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartlead_campaign_cumulative_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      smartlead_campaigns: {
        Row: {
          created_at: string
          engagement_id: string | null
          id: string
          name: string
          platform_id: string
          status: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          engagement_id?: string | null
          id?: string
          name: string
          platform_id: string
          status?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          engagement_id?: string | null
          id?: string
          name?: string
          platform_id?: string
          status?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smartlead_campaigns_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartlead_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      smartlead_daily_metrics: {
        Row: {
          bounced_count: number | null
          campaign_id: string
          clicked_count: number | null
          created_at: string
          id: string
          metric_date: string
          negative_reply_count: number | null
          opened_count: number | null
          positive_reply_count: number | null
          replied_count: number | null
          sent_count: number | null
          updated_at: string
          variant_id: string | null
          workspace_id: string
        }
        Insert: {
          bounced_count?: number | null
          campaign_id: string
          clicked_count?: number | null
          created_at?: string
          id?: string
          metric_date: string
          negative_reply_count?: number | null
          opened_count?: number | null
          positive_reply_count?: number | null
          replied_count?: number | null
          sent_count?: number | null
          updated_at?: string
          variant_id?: string | null
          workspace_id: string
        }
        Update: {
          bounced_count?: number | null
          campaign_id?: string
          clicked_count?: number | null
          created_at?: string
          id?: string
          metric_date?: string
          negative_reply_count?: number | null
          opened_count?: number | null
          positive_reply_count?: number | null
          replied_count?: number | null
          sent_count?: number | null
          updated_at?: string
          variant_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smartlead_daily_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "smartlead_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartlead_daily_metrics_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "smartlead_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartlead_daily_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      smartlead_message_events: {
        Row: {
          campaign_id: string
          created_at: string
          event_timestamp: string | null
          event_type: string
          id: string
          lead_id: string | null
          message_id: string | null
          reply_sentiment: string | null
          reply_text: string | null
          variant_id: string | null
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          event_timestamp?: string | null
          event_type: string
          id?: string
          lead_id?: string | null
          message_id?: string | null
          reply_sentiment?: string | null
          reply_text?: string | null
          variant_id?: string | null
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          event_timestamp?: string | null
          event_type?: string
          id?: string
          lead_id?: string | null
          message_id?: string | null
          reply_sentiment?: string | null
          reply_text?: string | null
          variant_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smartlead_message_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "smartlead_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartlead_message_events_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "smartlead_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartlead_message_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      smartlead_sequence_steps: {
        Row: {
          campaign_id: string
          created_at: string
          delay_days: number | null
          id: string
          step_number: number
          step_type: string | null
          variant_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          delay_days?: number | null
          id?: string
          step_number: number
          step_type?: string | null
          variant_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          delay_days?: number | null
          id?: string
          step_number?: number
          step_type?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smartlead_sequence_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "smartlead_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartlead_sequence_steps_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "smartlead_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      smartlead_variant_features: {
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
            foreignKeyName: "smartlead_variant_features_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "smartlead_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartlead_variant_features_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      smartlead_variants: {
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
          variant_type?: string
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
            foreignKeyName: "smartlead_variants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "smartlead_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      smartlead_workspace_daily_metrics: {
        Row: {
          bounced_count: number | null
          clicked_count: number | null
          created_at: string
          id: string
          metric_date: string
          opened_count: number | null
          positive_reply_count: number | null
          replied_count: number | null
          sent_count: number | null
          unsubscribed_count: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          bounced_count?: number | null
          clicked_count?: number | null
          created_at?: string
          id?: string
          metric_date: string
          opened_count?: number | null
          positive_reply_count?: number | null
          replied_count?: number | null
          sent_count?: number | null
          unsubscribed_count?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          bounced_count?: number | null
          clicked_count?: number | null
          created_at?: string
          id?: string
          metric_date?: string
          opened_count?: number | null
          positive_reply_count?: number | null
          replied_count?: number | null
          sent_count?: number | null
          unsubscribed_count?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smartlead_workspace_daily_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_status: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          last_cursor: string | null
          platform: string
          records_created: number | null
          records_processed: number | null
          records_updated: number | null
          started_at: string | null
          status: string
          sync_type: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_cursor?: string | null
          platform: string
          records_created?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string
          sync_type: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_cursor?: string | null
          platform?: string
          records_created?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_status_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      training_assignments: {
        Row: {
          assigned_by: string
          assignee_id: string
          assignment_type: string
          call_id: string
          completed_at: string | null
          created_at: string
          due_date: string | null
          focus_area: string | null
          id: string
          notes: string | null
          rep_feedback: string | null
          workspace_id: string
        }
        Insert: {
          assigned_by: string
          assignee_id: string
          assignment_type?: string
          call_id: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          focus_area?: string | null
          id?: string
          notes?: string | null
          rep_feedback?: string | null
          workspace_id: string
        }
        Update: {
          assigned_by?: string
          assignee_id?: string
          assignment_type?: string
          call_id?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          focus_area?: string | null
          id?: string
          notes?: string | null
          rep_feedback?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_assignments_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "phoneburner_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_campaign_variants: {
        Row: {
          body_preview: string | null
          campaign_id: string
          created_at: string | null
          delay_days: number | null
          email_body: string | null
          id: string
          is_control: boolean | null
          name: string | null
          platform: string
          platform_variant_id: string | null
          step_number: number
          subject_line: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          body_preview?: string | null
          campaign_id: string
          created_at?: string | null
          delay_days?: number | null
          email_body?: string | null
          id?: string
          is_control?: boolean | null
          name?: string | null
          platform: string
          platform_variant_id?: string | null
          step_number: number
          subject_line?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          body_preview?: string | null
          campaign_id?: string
          created_at?: string | null
          delay_days?: number | null
          email_body?: string | null
          id?: string
          is_control?: boolean | null
          name?: string | null
          platform?: string
          platform_variant_id?: string | null
          step_number?: number
          subject_line?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unified_campaign_variants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "unified_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_campaign_variants_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_campaigns: {
        Row: {
          created_at: string | null
          engagement_id: string | null
          id: string
          name: string
          platform: string
          platform_id: string
          status: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          engagement_id?: string | null
          id?: string
          name: string
          platform: string
          platform_id: string
          status?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          engagement_id?: string | null
          id?: string
          name?: string
          platform?: string
          platform_id?: string
          status?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unified_campaigns_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      workspace_metrics: {
        Row: {
          active_campaigns: number | null
          bounced_count: number | null
          clicked_count: number | null
          created_at: string | null
          id: string
          metric_date: string
          opened_count: number | null
          platform: string
          positive_reply_count: number | null
          replied_count: number | null
          sent_count: number | null
          workspace_id: string
        }
        Insert: {
          active_campaigns?: number | null
          bounced_count?: number | null
          clicked_count?: number | null
          created_at?: string | null
          id?: string
          metric_date: string
          opened_count?: number | null
          platform: string
          positive_reply_count?: number | null
          replied_count?: number | null
          sent_count?: number | null
          workspace_id: string
        }
        Update: {
          active_campaigns?: number | null
          bounced_count?: number | null
          clicked_count?: number | null
          created_at?: string | null
          id?: string
          metric_date?: string
          opened_count?: number | null
          platform?: string
          positive_reply_count?: number | null
          replied_count?: number | null
          sent_count?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_metrics_workspace_id_fkey"
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
      contact_engagement_summary: {
        Row: {
          assigned_to: string | null
          avg_ai_score: number | null
          calls_connected: number | null
          company: string | null
          contact_status: string | null
          email: string | null
          emails_bounced: number | null
          emails_clicked: number | null
          emails_opened: number | null
          emails_replied: number | null
          emails_sent: number | null
          first_contact_date: string | null
          first_name: string | null
          industry: string | null
          last_contact_at: string | null
          last_contact_date: string | null
          last_name: string | null
          lead_id: string | null
          seller_interest_score: number | null
          tags: string[] | null
          title: string | null
          total_calls: number | null
          total_talk_time_seconds: number | null
          voicemails_left: number | null
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
      domain_health_summary: {
        Row: {
          active_mailboxes: number | null
          avg_bounce_rate: number | null
          avg_health_score: number | null
          avg_reply_rate: number | null
          avg_warmup_percentage: number | null
          blacklist_status: string | null
          dkim_valid: boolean | null
          dmarc_valid: boolean | null
          domain: string | null
          domain_status: string | null
          google_postmaster_reputation: string | null
          is_bulk_sender: boolean | null
          mailbox_count: number | null
          spf_valid: boolean | null
          total_daily_capacity: number | null
          warming_up_count: number | null
          workspace_id: string | null
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
      gatekeeper_analytics: {
        Row: {
          avg_handling_score: number | null
          blocked_count: number | null
          call_count: number | null
          callback_count: number | null
          gatekeeper_outcome: string | null
          gatekeeper_technique_used: string | null
          transferred_count: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_ai_scores_workspace_id_fkey"
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
            referencedRelation: "contact_engagement_summary"
            referencedColumns: ["lead_id"]
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
      wrong_number_analytics: {
        Row: {
          corrected_count: number | null
          count: number | null
          data_source: string | null
          workspace_id: string | null
          wrong_number_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_ai_scores_workspace_id_fkey"
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
      decrypt_api_key: { Args: { encrypted_value: string }; Returns: string }
      encrypt_api_key: { Args: { key_value: string }; Returns: string }
      get_decrypted_api_key: {
        Args: { connection_id: string }
        Returns: string
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
