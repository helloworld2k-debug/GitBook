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
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          reason: string
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          admin_user_id: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          reason: string
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          reason?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          certificate_number: string
          created_at: string
          donation_id: string | null
          id: string
          issued_at: string
          render_version: number
          revoked_at: string | null
          sponsor_level_id: string | null
          status: Database["public"]["Enums"]["certificate_status"]
          type: Database["public"]["Enums"]["certificate_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          certificate_number: string
          created_at?: string
          donation_id?: string | null
          id?: string
          issued_at?: string
          render_version?: number
          revoked_at?: string | null
          sponsor_level_id?: string | null
          status?: Database["public"]["Enums"]["certificate_status"]
          type: Database["public"]["Enums"]["certificate_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          certificate_number?: string
          created_at?: string
          donation_id?: string | null
          id?: string
          issued_at?: string
          render_version?: number
          revoked_at?: string | null
          sponsor_level_id?: string | null
          status?: Database["public"]["Enums"]["certificate_status"]
          type?: Database["public"]["Enums"]["certificate_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_donation_id_fkey"
            columns: ["donation_id"]
            isOneToOne: false
            referencedRelation: "donations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_sponsor_level_id_fkey"
            columns: ["sponsor_level_id"]
            isOneToOne: false
            referencedRelation: "sponsor_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cloud_sync_cooldown_overrides: {
        Row: {
          consumed_at: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          override_type: string
          reason: string
          target_device_id: string | null
          target_machine_code_hash: string | null
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          override_type?: string
          reason: string
          target_device_id?: string | null
          target_machine_code_hash?: string | null
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          override_type?: string
          reason?: string
          target_device_id?: string | null
          target_machine_code_hash?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cloud_sync_cooldown_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cloud_sync_cooldown_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cloud_sync_leases: {
        Row: {
          cooldown_until: string | null
          created_at: string
          desktop_session_id: string
          device_id: string
          expires_at: string
          id: string
          last_heartbeat_at: string
          lease_started_at: string
          machine_code_hash: string
          released_at: string | null
          revoked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cooldown_until?: string | null
          created_at?: string
          desktop_session_id: string
          device_id: string
          expires_at: string
          id?: string
          last_heartbeat_at?: string
          lease_started_at?: string
          machine_code_hash: string
          released_at?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cooldown_until?: string | null
          created_at?: string
          desktop_session_id?: string
          device_id?: string
          expires_at?: string
          id?: string
          last_heartbeat_at?: string
          lease_started_at?: string
          machine_code_hash?: string
          released_at?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cloud_sync_leases_desktop_session_id_fkey"
            columns: ["desktop_session_id"]
            isOneToOne: false
            referencedRelation: "desktop_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cloud_sync_leases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cloud_sync_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "cloud_sync_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cloud_sync_usage_events: {
        Row: {
          desktop_session_id: string | null
          device_id: string | null
          event_type: string
          id: string
          lease_id: string | null
          machine_code_hash: string | null
          metadata: Json
          occurred_at: string
          reason: string | null
          user_id: string
        }
        Insert: {
          desktop_session_id?: string | null
          device_id?: string | null
          event_type: string
          id?: string
          lease_id?: string | null
          machine_code_hash?: string | null
          metadata?: Json
          occurred_at?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          desktop_session_id?: string | null
          device_id?: string | null
          event_type?: string
          id?: string
          lease_id?: string | null
          machine_code_hash?: string | null
          metadata?: Json
          occurred_at?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cloud_sync_usage_events_desktop_session_id_fkey"
            columns: ["desktop_session_id"]
            isOneToOne: false
            referencedRelation: "desktop_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cloud_sync_usage_events_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "cloud_sync_leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cloud_sync_usage_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cloud_sync_usage_sessions: {
        Row: {
          created_at: string
          desktop_session_id: string
          device_id: string
          end_reason: string | null
          ended_at: string | null
          heartbeat_count: number
          id: string
          last_heartbeat_at: string
          lease_id: string
          machine_code_hash: string
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          desktop_session_id: string
          device_id: string
          end_reason?: string | null
          ended_at?: string | null
          heartbeat_count?: number
          id?: string
          last_heartbeat_at: string
          lease_id: string
          machine_code_hash: string
          started_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          desktop_session_id?: string
          device_id?: string
          end_reason?: string | null
          ended_at?: string | null
          heartbeat_count?: number
          id?: string
          last_heartbeat_at?: string
          lease_id?: string
          machine_code_hash?: string
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cloud_sync_usage_sessions_desktop_session_id_fkey"
            columns: ["desktop_session_id"]
            isOneToOne: false
            referencedRelation: "desktop_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cloud_sync_usage_sessions_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: true
            referencedRelation: "cloud_sync_leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cloud_sync_usage_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      confirmation_resend_attempts: {
        Row: {
          created_at: string
          email_domain: string
          email_normalized: string
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email_domain: string
          email_normalized: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email_domain?: string
          email_normalized?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      deleted_users_archive: {
        Row: {
          account_status: string | null
          admin_role: string | null
          avatar_url: string | null
          created_at: string | null
          deleted_at: string
          deleted_by: string | null
          deleted_reason: string | null
          display_name: string | null
          email: string
          id: string
          is_admin: boolean | null
          metadata: Json | null
          original_user_id: string
          preferred_locale: string | null
          public_display_name: string | null
          public_supporter_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          account_status?: string | null
          admin_role?: string | null
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string
          deleted_by?: string | null
          deleted_reason?: string | null
          display_name?: string | null
          email: string
          id?: string
          is_admin?: boolean | null
          metadata?: Json | null
          original_user_id: string
          preferred_locale?: string | null
          public_display_name?: string | null
          public_supporter_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          account_status?: string | null
          admin_role?: string | null
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string
          deleted_by?: string | null
          deleted_reason?: string | null
          display_name?: string | null
          email?: string
          id?: string
          is_admin?: boolean | null
          metadata?: Json | null
          original_user_id?: string
          preferred_locale?: string | null
          public_display_name?: string | null
          public_supporter_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      desktop_auth_codes: {
        Row: {
          code_hash: string
          created_at: string
          device_session_id: string
          expires_at: string
          id: string
          return_url: string
          state: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          device_session_id: string
          expires_at: string
          id?: string
          return_url: string
          state: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          device_session_id?: string
          expires_at?: string
          id?: string
          return_url?: string
          state?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "desktop_auth_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      desktop_devices: {
        Row: {
          app_version: string | null
          created_at: string
          device_id: string
          device_name: string | null
          id: string
          last_seen_at: string
          machine_code_hash: string
          platform: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_id: string
          device_name?: string | null
          id?: string
          last_seen_at?: string
          machine_code_hash: string
          platform: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_id?: string
          device_name?: string | null
          id?: string
          last_seen_at?: string
          machine_code_hash?: string
          platform?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "desktop_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      desktop_sessions: {
        Row: {
          app_version: string | null
          cloud_sync_active_until: string | null
          created_at: string
          device_id: string
          expires_at: string
          id: string
          last_seen_at: string
          machine_code_hash: string
          platform: string
          revoked_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          cloud_sync_active_until?: string | null
          created_at?: string
          device_id: string
          expires_at: string
          id?: string
          last_seen_at?: string
          machine_code_hash: string
          platform: string
          revoked_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          cloud_sync_active_until?: string | null
          created_at?: string
          device_id?: string
          expires_at?: string
          id?: string
          last_seen_at?: string
          machine_code_hash?: string
          platform?: string
          revoked_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "desktop_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      donation_tiers: {
        Row: {
          amount: number
          code: string
          compare_at_amount: number | null
          created_at: string
          currency: string
          description: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount: number
          code: string
          compare_at_amount?: number | null
          created_at?: string
          currency?: string
          description: string
          id?: string
          is_active?: boolean
          label: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          amount?: number
          code?: string
          compare_at_amount?: number | null
          created_at?: string
          currency?: string
          description?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      donations: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          metadata: Json
          paid_at: string | null
          provider: Database["public"]["Enums"]["donation_provider"]
          provider_transaction_id: string
          status: Database["public"]["Enums"]["donation_status"]
          tier_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          paid_at?: string | null
          provider: Database["public"]["Enums"]["donation_provider"]
          provider_transaction_id: string
          status?: Database["public"]["Enums"]["donation_status"]
          tier_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          paid_at?: string | null
          provider?: Database["public"]["Enums"]["donation_provider"]
          provider_transaction_id?: string
          status?: Database["public"]["Enums"]["donation_status"]
          tier_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "donations_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "donation_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      license_code_batches: {
        Row: {
          channel_note: string | null
          channel_type: Database["public"]["Enums"]["license_code_channel_type"]
          code_count: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          duration_kind: Database["public"]["Enums"]["license_code_duration_kind"]
          id: string
          label: string
          trial_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          channel_note?: string | null
          channel_type?: Database["public"]["Enums"]["license_code_channel_type"]
          code_count: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duration_kind: Database["public"]["Enums"]["license_code_duration_kind"]
          id?: string
          label: string
          trial_days: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          channel_note?: string | null
          channel_type?: Database["public"]["Enums"]["license_code_channel_type"]
          code_count?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duration_kind?: Database["public"]["Enums"]["license_code_duration_kind"]
          id?: string
          label?: string
          trial_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "license_code_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_code_batches_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      license_code_redeem_attempts: {
        Row: {
          code_hash: string | null
          created_at: string
          id: string
          ip_address: string | null
          reason: string
          result: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          code_hash?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          reason: string
          result: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          code_hash?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          reason?: string
          result?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "license_code_redeem_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      license_code_redeem_blocks: {
        Row: {
          blocked_until: string
          created_at: string
          created_by: string | null
          id: string
          reason: string
          scope: string
          scope_value: string
        }
        Insert: {
          blocked_until: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason: string
          scope: string
          scope_value: string
        }
        Update: {
          blocked_until?: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string
          scope?: string
          scope_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_code_redeem_blocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      license_entitlement_grants: {
        Row: {
          created_at: string
          feature_code: Database["public"]["Enums"]["license_feature_code"]
          granted_days: number
          id: string
          source_donation_id: string
          user_id: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          created_at?: string
          feature_code?: Database["public"]["Enums"]["license_feature_code"]
          granted_days: number
          id?: string
          source_donation_id: string
          user_id: string
          valid_from: string
          valid_until: string
        }
        Update: {
          created_at?: string
          feature_code?: Database["public"]["Enums"]["license_feature_code"]
          granted_days?: number
          id?: string
          source_donation_id?: string
          user_id?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_entitlement_grants_source_donation_id_fkey"
            columns: ["source_donation_id"]
            isOneToOne: false
            referencedRelation: "donations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_entitlement_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      license_entitlements: {
        Row: {
          created_at: string
          feature_code: Database["public"]["Enums"]["license_feature_code"]
          id: string
          source_donation_id: string | null
          status: Database["public"]["Enums"]["license_entitlement_status"]
          updated_at: string
          user_id: string
          valid_until: string
        }
        Insert: {
          created_at?: string
          feature_code?: Database["public"]["Enums"]["license_feature_code"]
          id?: string
          source_donation_id?: string | null
          status?: Database["public"]["Enums"]["license_entitlement_status"]
          updated_at?: string
          user_id: string
          valid_until: string
        }
        Update: {
          created_at?: string
          feature_code?: Database["public"]["Enums"]["license_feature_code"]
          id?: string
          source_donation_id?: string | null
          status?: Database["public"]["Enums"]["license_entitlement_status"]
          updated_at?: string
          user_id?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_entitlements_source_donation_id_fkey"
            columns: ["source_donation_id"]
            isOneToOne: false
            referencedRelation: "donations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_entitlements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          email_domain: string
          email_normalized: string
          id: string
          ip_address: string | null
          result: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email_domain: string
          email_normalized: string
          id?: string
          ip_address?: string | null
          result: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email_domain?: string
          email_normalized?: string
          id?: string
          ip_address?: string | null
          result?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      machine_trial_claims: {
        Row: {
          created_at: string
          feature_code: Database["public"]["Enums"]["license_feature_code"]
          id: string
          machine_code_hash: string
          trial_code_id: string | null
          trial_started_at: string
          trial_valid_until: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_code?: Database["public"]["Enums"]["license_feature_code"]
          id?: string
          machine_code_hash: string
          trial_code_id?: string | null
          trial_started_at?: string
          trial_valid_until: string
          user_id: string
        }
        Update: {
          created_at?: string
          feature_code?: Database["public"]["Enums"]["license_feature_code"]
          id?: string
          machine_code_hash?: string
          trial_code_id?: string | null
          trial_started_at?: string
          trial_valid_until?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_trial_claims_trial_code_id_fkey"
            columns: ["trial_code_id"]
            isOneToOne: false
            referencedRelation: "trial_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_trial_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          body: string
          cover_image_path: string
          created_at: string
          created_by: string | null
          id: string
          image_alt: string
          is_ai_generated: boolean
          published_at: string | null
          slug: string
          summary: string
          title: string
          topic: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string
          cover_image_path: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_alt: string
          is_ai_generated?: boolean
          published_at?: string | null
          slug: string
          summary: string
          title: string
          topic: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          cover_image_path?: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_alt?: string
          is_ai_generated?: boolean
          published_at?: string | null
          slug?: string
          summary?: string
          title?: string
          topic?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_articles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_articles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          audience: Database["public"]["Enums"]["notification_audience"]
          body: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          locale: string | null
          priority: Database["public"]["Enums"]["notification_priority"]
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["notification_audience"]
          body: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          locale?: string | null
          priority?: Database["public"]["Enums"]["notification_priority"]
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["notification_audience"]
          body?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          locale?: string | null
          priority?: Database["public"]["Enums"]["notification_priority"]
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_pages: {
        Row: {
          body: string
          created_at: string
          slug: string
          sort_order: number
          summary: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string
          created_at?: string
          slug: string
          sort_order?: number
          summary: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          slug?: string
          sort_order?: number
          summary?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policy_pages_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          admin_role: string
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string
          email_verified: boolean
          id: string
          is_admin: boolean
          preferred_locale: string
          public_display_name: string | null
          public_supporter_enabled: boolean
          updated_at: string
        }
        Insert: {
          account_status?: string
          admin_role?: string
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          email_verified?: boolean
          id: string
          is_admin?: boolean
          preferred_locale?: string
          public_display_name?: string | null
          public_supporter_enabled?: boolean
          updated_at?: string
        }
        Update: {
          account_status?: string
          admin_role?: string
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          email_verified?: boolean
          id?: string
          is_admin?: boolean
          preferred_locale?: string
          public_display_name?: string | null
          public_supporter_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      registration_attempts: {
        Row: {
          created_at: string
          email_domain: string
          email_normalized: string
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email_domain: string
          email_normalized: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email_domain?: string
          email_normalized?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      registration_blocks: {
        Row: {
          blocked_until: string
          created_at: string
          created_by: string | null
          id: string
          reason: string
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          scope: string
          scope_value: string
        }
        Insert: {
          blocked_until: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          scope: string
          scope_value: string
        }
        Update: {
          blocked_until?: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          scope?: string
          scope_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_blocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_blocks_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      software_release_assets: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          platform: Database["public"]["Enums"]["software_release_platform"]
          release_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          platform: Database["public"]["Enums"]["software_release_platform"]
          release_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          platform?: Database["public"]["Enums"]["software_release_platform"]
          release_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "software_release_assets_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "software_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      software_releases: {
        Row: {
          created_at: string
          created_by: string | null
          delivery_mode: string
	          id: string
	          is_published: boolean
	          macos_arm64_backup_url: string | null
	          macos_arm64_primary_url: string | null
	          macos_backup_url: string | null
	          macos_primary_url: string | null
	          macos_x64_backup_url: string | null
	          macos_x64_primary_url: string | null
	          notes: string | null
          release_status: string
          released_at: string
          updated_at: string
          version: string
          windows_backup_url: string | null
          windows_primary_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery_mode?: string
	          id?: string
	          is_published?: boolean
	          macos_arm64_backup_url?: string | null
	          macos_arm64_primary_url?: string | null
	          macos_backup_url?: string | null
	          macos_primary_url?: string | null
	          macos_x64_backup_url?: string | null
	          macos_x64_primary_url?: string | null
	          notes?: string | null
          release_status?: string
          released_at: string
          updated_at?: string
          version: string
          windows_backup_url?: string | null
          windows_primary_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery_mode?: string
	          id?: string
	          is_published?: boolean
	          macos_arm64_backup_url?: string | null
	          macos_arm64_primary_url?: string | null
	          macos_backup_url?: string | null
	          macos_primary_url?: string | null
	          macos_x64_backup_url?: string | null
	          macos_x64_primary_url?: string | null
	          notes?: string | null
          release_status?: string
          released_at?: string
          updated_at?: string
          version?: string
          windows_backup_url?: string | null
          windows_primary_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "software_releases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_levels: {
        Row: {
          code: string
          currency: string
          id: string
          is_active: boolean
          label: string
          minimum_total_amount: number
          sort_order: number
        }
        Insert: {
          code: string
          currency?: string
          id?: string
          is_active?: boolean
          label: string
          minimum_total_amount: number
          sort_order: number
        }
        Update: {
          code?: string
          currency?: string
          id?: string
          is_active?: boolean
          label?: string
          minimum_total_amount?: number
          sort_order?: number
        }
        Relationships: []
      }
      support_contact_channels: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          label: string
          sort_order: number
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          created_at?: string
          id: string
          is_enabled?: boolean
          label: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_contact_channels_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_feedback: {
        Row: {
          category: string
          closed_at: string | null
          contact: string | null
          created_at: string
          email: string | null
          id: string
          message: string
          status: Database["public"]["Enums"]["support_feedback_status"]
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: string
          closed_at?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message: string
          status?: Database["public"]["Enums"]["support_feedback_status"]
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          closed_at?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          status?: Database["public"]["Enums"]["support_feedback_status"]
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_feedback_admin_reads: {
        Row: {
          admin_user_id: string
          feedback_id: string
          read_at: string
        }
        Insert: {
          admin_user_id: string
          feedback_id: string
          read_at?: string
        }
        Update: {
          admin_user_id?: string
          feedback_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_feedback_admin_reads_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_feedback_admin_reads_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "support_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      support_feedback_messages: {
        Row: {
          admin_user_id: string | null
          author_role: string
          body: string
          created_at: string
          feedback_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          admin_user_id?: string | null
          author_role: string
          body: string
          created_at?: string
          feedback_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          admin_user_id?: string | null
          author_role?: string
          body?: string
          created_at?: string
          feedback_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_feedback_messages_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_feedback_messages_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "support_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_feedback_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_code_redemptions: {
        Row: {
          bound_at: string | null
          created_at: string
          desktop_session_id: string | null
          device_id: string | null
          feature_code: Database["public"]["Enums"]["license_feature_code"]
          id: string
          machine_code_hash: string | null
          redeemed_at: string
          trial_code_id: string
          trial_valid_until: string
          user_id: string
        }
        Insert: {
          bound_at?: string | null
          created_at?: string
          desktop_session_id?: string | null
          device_id?: string | null
          feature_code?: Database["public"]["Enums"]["license_feature_code"]
          id?: string
          machine_code_hash?: string | null
          redeemed_at?: string
          trial_code_id: string
          trial_valid_until: string
          user_id: string
        }
        Update: {
          bound_at?: string | null
          created_at?: string
          desktop_session_id?: string | null
          device_id?: string | null
          feature_code?: Database["public"]["Enums"]["license_feature_code"]
          id?: string
          machine_code_hash?: string | null
          redeemed_at?: string
          trial_code_id?: string
          trial_valid_until?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_code_redemptions_desktop_session_id_fkey"
            columns: ["desktop_session_id"]
            isOneToOne: false
            referencedRelation: "desktop_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_code_redemptions_trial_code_id_fkey"
            columns: ["trial_code_id"]
            isOneToOne: false
            referencedRelation: "trial_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_code_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_codes: {
        Row: {
          batch_id: string | null
          channel_note: string | null
          channel_type: Database["public"]["Enums"]["license_code_channel_type"]
          code_hash: string
          code_mask: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          duration_kind: Database["public"]["Enums"]["license_code_duration_kind"]
          encrypted_code_algorithm: string
          encrypted_code_ciphertext: string | null
          encrypted_code_iv: string | null
          encrypted_code_tag: string | null
          ends_at: string | null
          feature_code: Database["public"]["Enums"]["license_feature_code"]
          id: string
          is_active: boolean
          label: string
          max_redemptions: number | null
          redemption_count: number
          starts_at: string | null
          trial_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          batch_id?: string | null
          channel_note?: string | null
          channel_type?: Database["public"]["Enums"]["license_code_channel_type"]
          code_hash: string
          code_mask?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duration_kind?: Database["public"]["Enums"]["license_code_duration_kind"]
          encrypted_code_algorithm?: string
          encrypted_code_ciphertext?: string | null
          encrypted_code_iv?: string | null
          encrypted_code_tag?: string | null
          ends_at?: string | null
          feature_code?: Database["public"]["Enums"]["license_feature_code"]
          id?: string
          is_active?: boolean
          label: string
          max_redemptions?: number | null
          redemption_count?: number
          starts_at?: string | null
          trial_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          batch_id?: string | null
          channel_note?: string | null
          channel_type?: Database["public"]["Enums"]["license_code_channel_type"]
          code_hash?: string
          code_mask?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duration_kind?: Database["public"]["Enums"]["license_code_duration_kind"]
          encrypted_code_algorithm?: string
          encrypted_code_ciphertext?: string | null
          encrypted_code_iv?: string | null
          encrypted_code_tag?: string | null
          ends_at?: string | null
          feature_code?: Database["public"]["Enums"]["license_feature_code"]
          id?: string
          is_active?: boolean
          label?: string
          max_redemptions?: number | null
          redemption_count?: number
          starts_at?: string | null
          trial_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_codes_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "license_code_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_codes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_login_history: {
        Row: {
          failure_reason: string | null
          id: string
          ip_address: unknown
          logged_in_at: string | null
          login_method: string | null
          success: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          logged_in_at?: string | null
          login_method?: string | null
          success?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          logged_in_at?: string | null
          login_method?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_login_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tag_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          tag_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          tag_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tag_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "user_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tag_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tags: {
        Row: {
          color: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          event_type: string | null
          id: string
          metadata: Json | null
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          event_type?: string | null
          id?: string
          metadata?: Json | null
          source: string
          status: string
        }
        Update: {
          created_at?: string
          event_type?: string | null
          id?: string
          metadata?: Json | null
          source?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_cloud_sync_lease: {
        Args: {
          input_desktop_session_id: string
          input_device_id: string
          input_expires_at: string
          input_machine_code_hash: string
          input_now: string
          input_user_id: string
        }
        Returns: {
          active_device_id: string
          available_after: string
          expires_at: string
          lease_id: string
          ok: boolean
          override_id: string
          reason: string
          remaining_seconds: number
          usage_session_id: string
        }[]
      }
      allocate_certificate_number: {
        Args: { input_type: Database["public"]["Enums"]["certificate_type"] }
        Returns: string
      }
      cleanup_confirmation_resend_attempts: {
        Args: { input_retention_days?: number }
        Returns: number
      }
      cleanup_old_webhook_logs: { Args: never; Returns: number }
      close_cloud_sync_usage_session: {
        Args: {
          input_end_reason: string
          input_ended_at: string
          input_lease_id: string
        }
        Returns: undefined
      }
      create_manual_paid_donation_with_audit: {
        Args: {
          input_admin_user_id: string
          input_amount: number
          input_currency: string
          input_provider_transaction_id: string
          input_reason: string
          input_user_id: string
        }
        Returns: string
      }
      exchange_desktop_auth_code: {
        Args: {
          input_app_version: string
          input_code_hash: string
          input_device_id: string
          input_device_name: string
          input_machine_code_hash: string
          input_now: string
          input_platform: string
          input_session_expires_at: string
          input_state: string
          input_token_hash: string
        }
        Returns: {
          desktop_session_id: string
          user_id: string
        }[]
      }
      find_active_cloud_sync_override: {
        Args: {
          input_machine_code_hash: string
          input_now: string
          input_override_type: string
          input_user_id: string
        }
        Returns: string
      }
      get_admin_auth_user_status: {
        Args: { input_user_ids: string[] }
        Returns: {
          banned_until: string
          confirmed_at: string
          deleted_at: string
          email: string
          email_confirmed_at: string
          has_password: boolean
          identity_providers: string[]
          invited_at: string
          last_sign_in_at: string
          recovery_sent_at: string
          user_id: string
        }[]
      }
      get_admin_users_paginated: {
        Args: {
          input_created_from?: string
          input_created_to?: string
          input_page?: number
          input_per_page?: number
          input_role_filter?: string
          input_search?: string
          input_sort_column?: string
          input_sort_direction?: string
          input_status_filter?: string
          input_type_filter?: string
        }
        Returns: {
          filtered_count: number
          total_count: number
          users: Json
        }[]
      }
      get_cloud_sync_cooldown_minutes: { Args: never; Returns: number }
      get_paid_total: { Args: { input_user_id: string }; Returns: number }
      get_public_sponsors: {
        Args: never
        Returns: {
          currency: string
          display_name: string
          paid_donation_count: number
          paid_total_amount: number
          public_sponsor_id: string
          sponsor_level_code: string
        }[]
      }
      refresh_desktop_session: {
        Args: {
          input_current_token_hash: string
          input_new_expires_at: string
          input_new_token_hash: string
          input_now: string
        }
        Returns: {
          desktop_session_id: string
          user_id: string
        }[]
      }
      grant_cloud_sync_entitlement_for_donation: {
        Args: {
          input_donation_id: string
          input_months: number
          input_paid_at: string
          input_user_id: string
        }
        Returns: string
      }
      has_active_cloud_sync_cooldown_override: {
        Args: { input_now: string; input_user_id: string }
        Returns: string
      }
      heartbeat_cloud_sync_lease: {
        Args: {
          input_desktop_session_id: string
          input_expires_at: string
          input_now: string
          input_user_id: string
        }
        Returns: {
          active_device_id: string
          expires_at: string
          lease_id: string
          ok: boolean
          reason: string
          usage_session_id: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      mark_cloud_sync_released_leases: {
        Args: { input_now: string; input_user_id: string }
        Returns: undefined
      }
      open_cloud_sync_usage_session: {
        Args: {
          input_desktop_session_id: string
          input_device_id: string
          input_lease_id: string
          input_machine_code_hash: string
          input_now: string
          input_user_id: string
        }
        Returns: string
      }
      permanently_delete_archived_user: {
        Args: { input_archive_id: string; input_deleted_by: string }
        Returns: {
          ok: boolean
          reason: string
        }[]
      }
      read_cloud_sync_lease_status: {
        Args: {
          input_desktop_session_id: string
          input_now: string
          input_user_id: string
        }
        Returns: {
          active_device_id: string
          ok: boolean
          reason: string
        }[]
      }
      record_cloud_sync_usage_event: {
        Args: {
          input_desktop_session_id: string
          input_device_id: string
          input_event_type: string
          input_lease_id: string
          input_machine_code_hash: string
          input_metadata: Json
          input_now: string
          input_reason: string
          input_user_id: string
        }
        Returns: string
      }
      record_user_login: {
        Args: {
          p_failure_reason?: string
          p_ip_address?: unknown
          p_login_method?: string
          p_success?: boolean
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      redeem_license_code: {
        Args: {
          input_code_hash: string
          input_machine_code_hash?: string
          input_now?: string
          input_user_id: string
        }
        Returns: {
          ok: boolean
          reason: string
          valid_until: string
        }[]
      }
      redeem_trial_code:
        | {
            Args: {
              input_code_hash: string
              input_machine_code_hash: string
              input_now: string
              input_user_id: string
            }
            Returns: {
              ok: boolean
              reason: string
              valid_until: string
            }[]
          }
        | {
            Args: {
              input_code_hash: string
              input_now: string
              input_user_id: string
            }
            Returns: {
              ok: boolean
              reason: string
              valid_until: string
            }[]
          }
      release_cloud_sync_lease: {
        Args: {
          input_desktop_session_id: string
          input_now: string
          input_user_id: string
        }
        Returns: boolean
      }
      restore_archived_user: {
        Args: { input_archive_id: string; input_restored_by: string }
        Returns: {
          ok: boolean
          reason: string
          restored_user_id: string
        }[]
      }
      revoke_certificate_with_audit: {
        Args: {
          input_admin_user_id: string
          input_certificate_id: string
          input_reason: string
        }
        Returns: string
      }
      revoke_cloud_sync_lease_with_usage: {
        Args: { input_cloud_sync_lease_id: string; input_now: string }
        Returns: boolean
      }
      revoke_desktop_session_with_leases: {
        Args: { input_desktop_session_id: string; input_now: string }
        Returns: boolean
      }
      touch_cloud_sync_usage_session: {
        Args: {
          input_desktop_session_id: string
          input_device_id: string
          input_lease_id: string
          input_machine_code_hash: string
          input_now: string
        }
        Returns: string
      }
    }
    Enums: {
      certificate_status: "active" | "revoked" | "generation_failed"
      certificate_type: "donation" | "honor"
      donation_provider: "stripe" | "paypal" | "manual" | "dodo"
      donation_status: "pending" | "paid" | "cancelled" | "failed" | "refunded"
      license_code_channel_type:
        | "internal"
        | "taobao"
        | "xianyu"
        | "partner"
        | "other"
      license_code_duration_kind:
        | "trial_3_day"
        | "month_1"
        | "month_3"
        | "year_1"
      license_entitlement_status: "active" | "expired" | "revoked"
      license_feature_code: "cloud_sync"
      notification_audience: "all" | "authenticated" | "admins"
      notification_priority: "info" | "success" | "warning" | "critical"
	      software_release_platform: "macos" | "macos_arm64" | "macos_x64" | "windows"
      support_feedback_status: "open" | "reviewing" | "closed"
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
      certificate_status: ["active", "revoked", "generation_failed"],
      certificate_type: ["donation", "honor"],
      donation_provider: ["stripe", "paypal", "manual", "dodo"],
      donation_status: ["pending", "paid", "cancelled", "failed", "refunded"],
      license_code_channel_type: [
        "internal",
        "taobao",
        "xianyu",
        "partner",
        "other",
      ],
      license_code_duration_kind: [
        "trial_3_day",
        "month_1",
        "month_3",
        "year_1",
      ],
      license_entitlement_status: ["active", "expired", "revoked"],
      license_feature_code: ["cloud_sync"],
      notification_audience: ["all", "authenticated", "admins"],
      notification_priority: ["info", "success", "warning", "critical"],
	      software_release_platform: ["macos", "macos_arm64", "macos_x64", "windows"],
      support_feedback_status: ["open", "reviewing", "closed"],
    },
  },
} as const
