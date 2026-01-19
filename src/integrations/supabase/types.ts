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
          callback_datetime: string | null
          callback_notes: string | null
          callback_scheduled: boolean | null
          caller_name: string | null
          caller_phone: string | null
          caller_user_id: string | null
          campaign_id: string | null
          company_id: string
          contact_id: string
          conversation_outcome: string | null
          created_at: string | null
          data_source_id: string | null
          disposition: string
          duration_seconds: number | null
          ended_at: string | null
          engagement_id: string
          external_id: string | null
          id: string
          notes: string | null
          raw_data: Json | null
          recording_duration: number | null
          recording_url: string | null
          ring_duration: number | null
          scheduled_at: string | null
          started_at: string | null
          synced_at: string | null
          talk_duration: number | null
          to_name: string | null
          to_phone: string
          transcription: string | null
          updated_at: string | null
          voicemail_left: boolean | null
          voicemail_template: string | null
        }
        Insert: {
          callback_datetime?: string | null
          callback_notes?: string | null
          callback_scheduled?: boolean | null
          caller_name?: string | null
          caller_phone?: string | null
          caller_user_id?: string | null
          campaign_id?: string | null
          company_id: string
          contact_id: string
          conversation_outcome?: string | null
          created_at?: string | null
          data_source_id?: string | null
          disposition: string
          duration_seconds?: number | null
          ended_at?: string | null
          engagement_id: string
          external_id?: string | null
          id?: string
          notes?: string | null
          raw_data?: Json | null
          recording_duration?: number | null
          recording_url?: string | null
          ring_duration?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          synced_at?: string | null
          talk_duration?: number | null
          to_name?: string | null
          to_phone: string
          transcription?: string | null
          updated_at?: string | null
          voicemail_left?: boolean | null
          voicemail_template?: string | null
        }
        Update: {
          callback_datetime?: string | null
          callback_notes?: string | null
          callback_scheduled?: boolean | null
          caller_name?: string | null
          caller_phone?: string | null
          caller_user_id?: string | null
          campaign_id?: string | null
          company_id?: string
          contact_id?: string
          conversation_outcome?: string | null
          created_at?: string | null
          data_source_id?: string | null
          disposition?: string
          duration_seconds?: number | null
          ended_at?: string | null
          engagement_id?: string
          external_id?: string | null
          id?: string
          notes?: string | null
          raw_data?: Json | null
          recording_duration?: number | null
          recording_url?: string | null
          ring_duration?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          synced_at?: string | null
          talk_duration?: number | null
          to_name?: string | null
          to_phone?: string
          transcription?: string | null
          updated_at?: string | null
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
        ]
      }
      campaigns: {
        Row: {
          campaign_type: string
          completed_at: string | null
          created_at: string | null
          data_source_id: string | null
          engagement_id: string
          external_id: string | null
          external_url: string | null
          id: string
          last_synced_at: string | null
          name: string
          settings: Json | null
          started_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          campaign_type: string
          completed_at?: string | null
          created_at?: string | null
          data_source_id?: string | null
          engagement_id: string
          external_id?: string | null
          external_url?: string | null
          id?: string
          last_synced_at?: string | null
          name: string
          settings?: Json | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          campaign_type?: string
          completed_at?: string | null
          created_at?: string | null
          data_source_id?: string | null
          engagement_id?: string
          external_id?: string | null
          external_url?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string
          settings?: Json | null
          started_at?: string | null
          status?: string | null
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
          created_at: string | null
          id: string
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
          created_at?: string | null
          id?: string
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
          created_at?: string | null
          id?: string
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
        Relationships: []
      }
      contacts: {
        Row: {
          best_time_to_call: string | null
          company_id: string
          created_at: string | null
          deleted_at: string | null
          department: string | null
          do_not_call: boolean | null
          do_not_contact: boolean | null
          do_not_email: boolean | null
          email: string | null
          email_status: string | null
          engagement_id: string
          first_name: string | null
          id: string
          is_decision_maker: boolean | null
          is_primary: boolean | null
          last_contacted_at: string | null
          last_name: string | null
          last_responded_at: string | null
          linkedin_url: string | null
          mobile: string | null
          phone: string | null
          phone_status: string | null
          source: string | null
          timezone: string | null
          title: string | null
          title_level: string | null
          total_calls: number | null
          total_conversations: number | null
          total_emails_opened: number | null
          total_emails_replied: number | null
          total_emails_sent: number | null
          updated_at: string | null
        }
        Insert: {
          best_time_to_call?: string | null
          company_id: string
          created_at?: string | null
          deleted_at?: string | null
          department?: string | null
          do_not_call?: boolean | null
          do_not_contact?: boolean | null
          do_not_email?: boolean | null
          email?: string | null
          email_status?: string | null
          engagement_id: string
          first_name?: string | null
          id?: string
          is_decision_maker?: boolean | null
          is_primary?: boolean | null
          last_contacted_at?: string | null
          last_name?: string | null
          last_responded_at?: string | null
          linkedin_url?: string | null
          mobile?: string | null
          phone?: string | null
          phone_status?: string | null
          source?: string | null
          timezone?: string | null
          title?: string | null
          title_level?: string | null
          total_calls?: number | null
          total_conversations?: number | null
          total_emails_opened?: number | null
          total_emails_replied?: number | null
          total_emails_sent?: number | null
          updated_at?: string | null
        }
        Update: {
          best_time_to_call?: string | null
          company_id?: string
          created_at?: string | null
          deleted_at?: string | null
          department?: string | null
          do_not_call?: boolean | null
          do_not_contact?: boolean | null
          do_not_email?: boolean | null
          email?: string | null
          email_status?: string | null
          engagement_id?: string
          first_name?: string | null
          id?: string
          is_decision_maker?: boolean | null
          is_primary?: boolean | null
          last_contacted_at?: string | null
          last_name?: string | null
          last_responded_at?: string | null
          linkedin_url?: string | null
          mobile?: string | null
          phone?: string | null
          phone_status?: string | null
          source?: string | null
          timezone?: string | null
          title?: string | null
          title_level?: string | null
          total_calls?: number | null
          total_conversations?: number | null
          total_emails_opened?: number | null
          total_emails_replied?: number | null
          total_emails_sent?: number | null
          updated_at?: string | null
        }
        Relationships: [
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
        Relationships: []
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
        Relationships: []
      }
      data_sources: {
        Row: {
          access_token: string | null
          additional_config: Json | null
          api_key_encrypted: string | null
          api_secret_encrypted: string | null
          created_at: string | null
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          name: string
          refresh_token: string | null
          source_type: string
          status: string | null
          sync_enabled: boolean | null
          sync_frequency: string | null
          token_expires_at: string | null
          updated_at: string | null
          webhook_secret: string | null
        }
        Insert: {
          access_token?: string | null
          additional_config?: Json | null
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          name: string
          refresh_token?: string | null
          source_type: string
          status?: string | null
          sync_enabled?: boolean | null
          sync_frequency?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string | null
          additional_config?: Json | null
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          name?: string
          refresh_token?: string | null
          source_type?: string
          status?: string | null
          sync_enabled?: boolean | null
          sync_frequency?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Relationships: []
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
        Relationships: []
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
          click_count: number | null
          clicked: boolean | null
          company_id: string
          contact_id: string
          created_at: string | null
          data_source_id: string | null
          delivered: boolean | null
          delivered_at: string | null
          engagement_id: string
          external_id: string | null
          external_message_id: string | null
          first_clicked_at: string | null
          first_opened_at: string | null
          from_email: string | null
          from_name: string | null
          id: string
          last_opened_at: string | null
          marked_spam: boolean | null
          open_count: number | null
          opened: boolean | null
          raw_data: Json | null
          replied: boolean | null
          replied_at: string | null
          reply_sentiment: string | null
          reply_text: string | null
          scheduled_at: string | null
          sent: boolean | null
          sent_at: string | null
          sequence_id: string | null
          step_number: number | null
          subject: string | null
          synced_at: string | null
          to_email: string
          unsubscribed: boolean | null
          unsubscribed_at: string | null
          updated_at: string | null
        }
        Insert: {
          body_preview?: string | null
          bounce_reason?: string | null
          bounce_type?: string | null
          bounced?: boolean | null
          bounced_at?: string | null
          campaign_id?: string | null
          click_count?: number | null
          clicked?: boolean | null
          company_id: string
          contact_id: string
          created_at?: string | null
          data_source_id?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          engagement_id: string
          external_id?: string | null
          external_message_id?: string | null
          first_clicked_at?: string | null
          first_opened_at?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          last_opened_at?: string | null
          marked_spam?: boolean | null
          open_count?: number | null
          opened?: boolean | null
          raw_data?: Json | null
          replied?: boolean | null
          replied_at?: string | null
          reply_sentiment?: string | null
          reply_text?: string | null
          scheduled_at?: string | null
          sent?: boolean | null
          sent_at?: string | null
          sequence_id?: string | null
          step_number?: number | null
          subject?: string | null
          synced_at?: string | null
          to_email: string
          unsubscribed?: boolean | null
          unsubscribed_at?: string | null
          updated_at?: string | null
        }
        Update: {
          body_preview?: string | null
          bounce_reason?: string | null
          bounce_type?: string | null
          bounced?: boolean | null
          bounced_at?: string | null
          campaign_id?: string | null
          click_count?: number | null
          clicked?: boolean | null
          company_id?: string
          contact_id?: string
          created_at?: string | null
          data_source_id?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          engagement_id?: string
          external_id?: string | null
          external_message_id?: string | null
          first_clicked_at?: string | null
          first_opened_at?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          last_opened_at?: string | null
          marked_spam?: boolean | null
          open_count?: number | null
          opened?: boolean | null
          raw_data?: Json | null
          replied?: boolean | null
          replied_at?: string | null
          reply_sentiment?: string | null
          reply_text?: string | null
          scheduled_at?: string | null
          sent?: boolean | null
          sent_at?: string | null
          sequence_id?: string | null
          step_number?: number | null
          subject?: string | null
          synced_at?: string | null
          to_email?: string
          unsubscribed?: boolean | null
          unsubscribed_at?: string | null
          updated_at?: string | null
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
        Relationships: []
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
        Relationships: []
      }
      engagements: {
        Row: {
          client_id: string
          created_at: string | null
          deleted_at: string | null
          description: string | null
          end_date: string | null
          id: string
          meeting_goal: number | null
          name: string
          start_date: string | null
          status: string | null
          target_criteria: Json | null
          target_list_size: number | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          meeting_goal?: number | null
          name: string
          start_date?: string | null
          status?: string | null
          target_criteria?: Json | null
          target_list_size?: number | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          meeting_goal?: number | null
          name?: string
          start_date?: string | null
          status?: string | null
          target_criteria?: Json | null
          target_list_size?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engagements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
            foreignKeyName: "replyio_daily_metrics_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "replyio_variants"
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
            foreignKeyName: "replyio_message_events_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "replyio_variants"
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
        Relationships: []
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
        Relationships: []
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
          body_template: string | null
          campaign_id: string
          created_at: string | null
          delay_days: number | null
          delay_hours: number | null
          external_id: string | null
          id: string
          send_days: string[] | null
          send_window_end: string | null
          send_window_start: string | null
          status: string | null
          step_name: string | null
          step_number: number
          subject_line: string | null
          updated_at: string | null
        }
        Insert: {
          body_template?: string | null
          campaign_id: string
          created_at?: string | null
          delay_days?: number | null
          delay_hours?: number | null
          external_id?: string | null
          id?: string
          send_days?: string[] | null
          send_window_end?: string | null
          send_window_start?: string | null
          status?: string | null
          step_name?: string | null
          step_number: number
          subject_line?: string | null
          updated_at?: string | null
        }
        Update: {
          body_template?: string | null
          campaign_id?: string
          created_at?: string | null
          delay_days?: number | null
          delay_hours?: number | null
          external_id?: string | null
          id?: string
          send_days?: string[] | null
          send_window_end?: string | null
          send_window_start?: string | null
          status?: string | null
          step_name?: string | null
          step_number?: number
          subject_line?: string | null
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
        Relationships: []
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
            foreignKeyName: "smartlead_daily_metrics_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "smartlead_variants"
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
            foreignKeyName: "smartlead_message_events_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "smartlead_variants"
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
        Relationships: []
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
        Relationships: []
      }
      webhook_events: {
        Row: {
          data_source_id: string | null
          event_id: string | null
          event_type: string
          headers: Json | null
          id: string
          payload: Json
          processed: boolean | null
          processed_at: string | null
          processing_error: string | null
          received_at: string | null
          retry_count: number | null
          source_type: string
        }
        Insert: {
          data_source_id?: string | null
          event_id?: string | null
          event_type: string
          headers?: Json | null
          id?: string
          payload: Json
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string | null
          retry_count?: number | null
          source_type: string
        }
        Update: {
          data_source_id?: string | null
          event_id?: string | null
          event_type?: string
          headers?: Json | null
          id?: string
          payload?: Json
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string | null
          retry_count?: number | null
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
        ]
      }
    }
    Views: {
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
        Relationships: []
      }
    }
    Functions: {
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
      is_client_admin: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      is_client_member: {
        Args: { _client_id: string; _user_id: string }
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
