export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Enums: {
      certificate_status: "active" | "revoked" | "generation_failed";
      certificate_type: "donation" | "honor";
      donation_provider: "stripe" | "paypal" | "manual" | "dodo";
      donation_status: "pending" | "paid" | "cancelled" | "failed" | "refunded";
      license_code_duration_kind: "trial_3_day" | "month_1" | "month_3" | "year_1";
      license_entitlement_status: "active" | "expired" | "revoked";
      license_feature_code: "cloud_sync";
      notification_audience: "all" | "authenticated" | "admins";
      notification_priority: "info" | "success" | "warning" | "critical";
      software_release_platform: "macos" | "windows";
      support_feedback_status: "open" | "reviewing" | "closed";
    };
    Tables: {
      donation_tiers: {
        Row: {
          id: string;
          code: string;
          label: string;
          description: string;
          amount: number;
          currency: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          label: string;
          description: string;
          amount: number;
          currency?: string;
          sort_order: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          label?: string;
          description?: string;
          amount?: number;
          currency?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          preferred_locale: "en" | "zh-Hant" | "ja" | "ko";
          public_supporter_enabled: boolean;
          public_display_name: string | null;
          is_admin: boolean;
          admin_role: "owner" | "operator" | "user";
          account_status: "active" | "disabled";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          preferred_locale?: "en" | "zh-Hant" | "ja" | "ko";
          public_supporter_enabled?: boolean;
          public_display_name?: string | null;
          is_admin?: boolean;
          admin_role?: "owner" | "operator" | "user";
          account_status?: "active" | "disabled";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          preferred_locale?: "en" | "zh-Hant" | "ja" | "ko";
          public_supporter_enabled?: boolean;
          public_display_name?: string | null;
          is_admin?: boolean;
          admin_role?: "owner" | "operator" | "user";
          account_status?: "active" | "disabled";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      donations: {
        Row: {
          id: string;
          user_id: string;
          tier_id: string | null;
          amount: number;
          currency: string;
          provider: Database["public"]["Enums"]["donation_provider"];
          provider_transaction_id: string;
          status: Database["public"]["Enums"]["donation_status"];
          paid_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tier_id?: string | null;
          amount: number;
          currency?: string;
          provider: Database["public"]["Enums"]["donation_provider"];
          provider_transaction_id: string;
          status?: Database["public"]["Enums"]["donation_status"];
          paid_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tier_id?: string | null;
          amount?: number;
          currency?: string;
          provider?: Database["public"]["Enums"]["donation_provider"];
          provider_transaction_id?: string;
          status?: Database["public"]["Enums"]["donation_status"];
          paid_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      license_entitlements: {
        Row: {
          id: string;
          user_id: string;
          feature_code: Database["public"]["Enums"]["license_feature_code"];
          valid_until: string;
          status: Database["public"]["Enums"]["license_entitlement_status"];
          source_donation_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          feature_code?: Database["public"]["Enums"]["license_feature_code"];
          valid_until: string;
          status?: Database["public"]["Enums"]["license_entitlement_status"];
          source_donation_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          feature_code?: Database["public"]["Enums"]["license_feature_code"];
          valid_until?: string;
          status?: Database["public"]["Enums"]["license_entitlement_status"];
          source_donation_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "license_entitlements_source_donation_id_fkey";
            columns: ["source_donation_id"];
            isOneToOne: false;
            referencedRelation: "donations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "license_entitlements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      license_entitlement_grants: {
        Row: {
          id: string;
          user_id: string;
          feature_code: Database["public"]["Enums"]["license_feature_code"];
          source_donation_id: string;
          granted_days: number;
          valid_from: string;
          valid_until: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          feature_code?: Database["public"]["Enums"]["license_feature_code"];
          source_donation_id: string;
          granted_days: number;
          valid_from: string;
          valid_until: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          feature_code?: Database["public"]["Enums"]["license_feature_code"];
          source_donation_id?: string;
          granted_days?: number;
          valid_from?: string;
          valid_until?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "license_entitlement_grants_source_donation_id_fkey";
            columns: ["source_donation_id"];
            isOneToOne: false;
            referencedRelation: "donations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "license_entitlement_grants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      trial_codes: {
        Row: {
          id: string;
          code_hash: string;
          label: string;
          feature_code: Database["public"]["Enums"]["license_feature_code"];
          trial_days: number;
          starts_at: string | null;
          ends_at: string | null;
          max_redemptions: number | null;
          redemption_count: number;
          is_active: boolean;
          created_by: string | null;
          duration_kind: Database["public"]["Enums"]["license_code_duration_kind"];
          code_mask: string | null;
          encrypted_code_ciphertext: string | null;
          encrypted_code_iv: string | null;
          encrypted_code_tag: string | null;
          encrypted_code_algorithm: string;
          batch_id: string | null;
          deleted_at: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code_hash: string;
          label: string;
          feature_code?: Database["public"]["Enums"]["license_feature_code"];
          trial_days?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          max_redemptions?: number | null;
          redemption_count?: number;
          is_active?: boolean;
          created_by?: string | null;
          duration_kind?: Database["public"]["Enums"]["license_code_duration_kind"];
          code_mask?: string | null;
          encrypted_code_ciphertext?: string | null;
          encrypted_code_iv?: string | null;
          encrypted_code_tag?: string | null;
          encrypted_code_algorithm?: string;
          batch_id?: string | null;
          deleted_at?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code_hash?: string;
          label?: string;
          feature_code?: Database["public"]["Enums"]["license_feature_code"];
          trial_days?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          max_redemptions?: number | null;
          redemption_count?: number;
          is_active?: boolean;
          created_by?: string | null;
          duration_kind?: Database["public"]["Enums"]["license_code_duration_kind"];
          code_mask?: string | null;
          encrypted_code_ciphertext?: string | null;
          encrypted_code_iv?: string | null;
          encrypted_code_tag?: string | null;
          encrypted_code_algorithm?: string;
          batch_id?: string | null;
          deleted_at?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trial_codes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trial_codes_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      trial_code_redemptions: {
        Row: {
          id: string;
          trial_code_id: string;
          user_id: string;
          machine_code_hash: string | null;
          feature_code: Database["public"]["Enums"]["license_feature_code"];
          redeemed_at: string;
          trial_valid_until: string;
          bound_at: string | null;
          desktop_session_id: string | null;
          device_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trial_code_id: string;
          user_id: string;
          machine_code_hash?: string | null;
          feature_code?: Database["public"]["Enums"]["license_feature_code"];
          redeemed_at?: string;
          trial_valid_until: string;
          bound_at?: string | null;
          desktop_session_id?: string | null;
          device_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          trial_code_id?: string;
          user_id?: string;
          machine_code_hash?: string | null;
          feature_code?: Database["public"]["Enums"]["license_feature_code"];
          redeemed_at?: string;
          trial_valid_until?: string;
          bound_at?: string | null;
          desktop_session_id?: string | null;
          device_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trial_code_redemptions_trial_code_id_fkey";
            columns: ["trial_code_id"];
            isOneToOne: false;
            referencedRelation: "trial_codes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trial_code_redemptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      machine_trial_claims: {
        Row: {
          id: string;
          machine_code_hash: string;
          user_id: string;
          trial_code_id: string | null;
          feature_code: Database["public"]["Enums"]["license_feature_code"];
          trial_started_at: string;
          trial_valid_until: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          machine_code_hash: string;
          user_id: string;
          trial_code_id?: string | null;
          feature_code?: Database["public"]["Enums"]["license_feature_code"];
          trial_started_at?: string;
          trial_valid_until: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          machine_code_hash?: string;
          user_id?: string;
          trial_code_id?: string | null;
          feature_code?: Database["public"]["Enums"]["license_feature_code"];
          trial_started_at?: string;
          trial_valid_until?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "machine_trial_claims_trial_code_id_fkey";
            columns: ["trial_code_id"];
            isOneToOne: false;
            referencedRelation: "trial_codes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "machine_trial_claims_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      desktop_auth_codes: {
        Row: {
          id: string;
          code_hash: string;
          user_id: string;
          device_session_id: string;
          return_url: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code_hash: string;
          user_id: string;
          device_session_id: string;
          return_url: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          code_hash?: string;
          user_id?: string;
          device_session_id?: string;
          return_url?: string;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "desktop_auth_codes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      desktop_devices: {
        Row: {
          id: string;
          user_id: string;
          device_id: string;
          machine_code_hash: string;
          platform: string;
          device_name: string | null;
          app_version: string | null;
          last_seen_at: string;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          device_id: string;
          machine_code_hash: string;
          platform: string;
          device_name?: string | null;
          app_version?: string | null;
          last_seen_at?: string;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          device_id?: string;
          machine_code_hash?: string;
          platform?: string;
          device_name?: string | null;
          app_version?: string | null;
          last_seen_at?: string;
          revoked_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "desktop_devices_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      desktop_sessions: {
        Row: {
          id: string;
          user_id: string;
          token_hash: string;
          device_id: string;
          machine_code_hash: string;
          platform: string;
          app_version: string | null;
          last_seen_at: string;
          cloud_sync_active_until: string | null;
          expires_at: string;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token_hash: string;
          device_id: string;
          machine_code_hash: string;
          platform: string;
          app_version?: string | null;
          last_seen_at?: string;
          cloud_sync_active_until?: string | null;
          expires_at: string;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token_hash?: string;
          device_id?: string;
          machine_code_hash?: string;
          platform?: string;
          app_version?: string | null;
          last_seen_at?: string;
          cloud_sync_active_until?: string | null;
          expires_at?: string;
          revoked_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "desktop_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cloud_sync_leases: {
        Row: {
          id: string;
          user_id: string;
          desktop_session_id: string;
          device_id: string;
          machine_code_hash: string;
          lease_started_at: string;
          last_heartbeat_at: string;
          expires_at: string;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          desktop_session_id: string;
          device_id: string;
          machine_code_hash: string;
          lease_started_at?: string;
          last_heartbeat_at?: string;
          expires_at: string;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          desktop_session_id?: string;
          device_id?: string;
          machine_code_hash?: string;
          lease_started_at?: string;
          last_heartbeat_at?: string;
          expires_at?: string;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cloud_sync_leases_desktop_session_id_fkey";
            columns: ["desktop_session_id"];
            isOneToOne: false;
            referencedRelation: "desktop_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cloud_sync_leases_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      sponsor_levels: {
        Row: {
          id: string;
          code: string;
          label: string;
          minimum_total_amount: number;
          currency: string;
          sort_order: number;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          code: string;
          label: string;
          minimum_total_amount: number;
          currency?: string;
          sort_order: number;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          code?: string;
          label?: string;
          minimum_total_amount?: number;
          currency?: string;
          sort_order?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      software_releases: {
        Row: {
          id: string;
          version: string;
          released_at: string;
          notes: string | null;
          is_published: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          version: string;
          released_at: string;
          notes?: string | null;
          is_published?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          version?: string;
          released_at?: string;
          notes?: string | null;
          is_published?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "software_releases_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      software_release_assets: {
        Row: {
          id: string;
          release_id: string;
          platform: Database["public"]["Enums"]["software_release_platform"];
          file_name: string;
          storage_path: string;
          file_size: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          release_id: string;
          platform: Database["public"]["Enums"]["software_release_platform"];
          file_name: string;
          storage_path: string;
          file_size?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          release_id?: string;
          platform?: Database["public"]["Enums"]["software_release_platform"];
          file_name?: string;
          storage_path?: string;
          file_size?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "software_release_assets_release_id_fkey";
            columns: ["release_id"];
            isOneToOne: false;
            referencedRelation: "software_releases";
            referencedColumns: ["id"];
          },
        ];
      };
      certificates: {
        Row: {
          id: string;
          certificate_number: string;
          user_id: string;
          donation_id: string | null;
          sponsor_level_id: string | null;
          type: Database["public"]["Enums"]["certificate_type"];
          status: Database["public"]["Enums"]["certificate_status"];
          issued_at: string | null;
          revoked_at: string | null;
          render_version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          certificate_number: string;
          user_id: string;
          donation_id?: string | null;
          sponsor_level_id?: string | null;
          type: Database["public"]["Enums"]["certificate_type"];
          status?: Database["public"]["Enums"]["certificate_status"];
          issued_at?: string | null;
          revoked_at?: string | null;
          render_version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          certificate_number?: string;
          user_id?: string;
          donation_id?: string | null;
          sponsor_level_id?: string | null;
          type?: Database["public"]["Enums"]["certificate_type"];
          status?: Database["public"]["Enums"]["certificate_status"];
          issued_at?: string | null;
          revoked_at?: string | null;
          render_version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_audit_logs: {
        Row: {
          id: string;
          admin_user_id: string;
          action: string;
          target_type: string;
          target_id: string;
          before: Json;
          after: Json;
          reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_user_id: string;
          action: string;
          target_type: string;
          target_id: string;
          before?: Json;
          after?: Json;
          reason: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_user_id?: string;
          action?: string;
          target_type?: string;
          target_id?: string;
          before?: Json;
          after?: Json;
          reason?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_user_id_fkey";
            columns: ["admin_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          title: string;
          body: string;
          locale: "en" | "zh-Hant" | "ja" | "ko" | null;
          audience: Database["public"]["Enums"]["notification_audience"];
          priority: Database["public"]["Enums"]["notification_priority"];
          published_at: string | null;
          expires_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          body: string;
          locale?: "en" | "zh-Hant" | "ja" | "ko" | null;
          audience?: Database["public"]["Enums"]["notification_audience"];
          priority?: Database["public"]["Enums"]["notification_priority"];
          published_at?: string | null;
          expires_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          body?: string;
          locale?: "en" | "zh-Hant" | "ja" | "ko" | null;
          audience?: Database["public"]["Enums"]["notification_audience"];
          priority?: Database["public"]["Enums"]["notification_priority"];
          published_at?: string | null;
          expires_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_reads: {
        Row: {
          notification_id: string;
          user_id: string;
          read_at: string;
        };
        Insert: {
          notification_id: string;
          user_id: string;
          read_at?: string;
        };
        Update: {
          notification_id?: string;
          user_id?: string;
          read_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_reads_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      support_feedback: {
        Row: {
          id: string;
          user_id: string | null;
          email: string | null;
          contact: string | null;
          category: string;
          subject: string;
          message: string;
          status: Database["public"]["Enums"]["support_feedback_status"];
          created_at: string;
          updated_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          email?: string | null;
          contact?: string | null;
          category?: string;
          subject: string;
          message: string;
          status?: Database["public"]["Enums"]["support_feedback_status"];
          created_at?: string;
          updated_at?: string;
          closed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          email?: string | null;
          contact?: string | null;
          category?: string;
          subject?: string;
          message?: string;
          status?: Database["public"]["Enums"]["support_feedback_status"];
          created_at?: string;
          updated_at?: string;
          closed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "support_feedback_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      support_feedback_messages: {
        Row: {
          id: string;
          feedback_id: string;
          user_id: string | null;
          admin_user_id: string | null;
          author_role: "user" | "admin";
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          feedback_id: string;
          user_id?: string | null;
          admin_user_id?: string | null;
          author_role: "user" | "admin";
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          feedback_id?: string;
          user_id?: string | null;
          admin_user_id?: string | null;
          author_role?: "user" | "admin";
          body?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_feedback_messages_admin_user_id_fkey";
            columns: ["admin_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_feedback_messages_feedback_id_fkey";
            columns: ["feedback_id"];
            isOneToOne: false;
            referencedRelation: "support_feedback";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_feedback_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      allocate_certificate_number: {
        Args: { input_type: Database["public"]["Enums"]["certificate_type"] };
        Returns: string;
      };
      get_public_sponsors: {
        Args: Record<PropertyKey, never>;
        Returns: {
          public_sponsor_id: string;
          display_name: string | null;
          paid_donation_count: number;
          paid_total_amount: number;
          currency: string;
          sponsor_level_code: string | null;
        }[];
      };
      create_manual_paid_donation_with_audit: {
        Args: {
          input_admin_user_id: string;
          input_amount: number;
          input_currency: string;
          input_provider_transaction_id: string;
          input_reason: string;
          input_user_id: string;
        };
        Returns: string;
      };
      grant_cloud_sync_entitlement_for_donation: {
        Args: {
          input_days: number;
          input_donation_id: string;
          input_paid_at: string;
          input_user_id: string;
        };
        Returns: string;
      };
      activate_cloud_sync_lease: {
        Args: {
          input_desktop_session_id: string;
          input_device_id: string;
          input_expires_at: string;
          input_machine_code_hash: string;
          input_now: string;
          input_user_id: string;
        };
        Returns: {
          active_device_id: string | null;
          expires_at: string | null;
          lease_id: string | null;
          ok: boolean;
          reason: string;
        }[];
      };
      heartbeat_cloud_sync_lease: {
        Args: {
          input_desktop_session_id: string;
          input_expires_at: string;
          input_now: string;
          input_user_id: string;
        };
        Returns: {
          active_device_id: string | null;
          expires_at: string | null;
          lease_id: string | null;
          ok: boolean;
          reason: string;
        }[];
      };
      release_cloud_sync_lease: {
        Args: {
          input_desktop_session_id: string;
          input_now: string;
          input_user_id: string;
        };
        Returns: boolean;
      };
      revoke_desktop_session_with_leases: {
        Args: {
          input_desktop_session_id: string;
          input_now: string;
        };
        Returns: boolean;
      };
      read_cloud_sync_lease_status: {
        Args: {
          input_desktop_session_id: string;
          input_now: string;
          input_user_id: string;
        };
        Returns: {
          active_device_id: string | null;
          ok: boolean;
          reason: string;
        }[];
      };
      redeem_trial_code: {
        Args: {
          input_code_hash: string;
          input_now: string;
          input_user_id: string;
        };
        Returns: {
          ok: boolean;
          reason: string;
          valid_until: string | null;
        }[];
      };
      exchange_desktop_auth_code: {
        Args: {
          input_app_version: string | null;
          input_code_hash: string;
          input_device_id: string;
          input_device_name: string | null;
          input_machine_code_hash: string;
          input_now: string;
          input_platform: string;
          input_session_expires_at: string;
          input_token_hash: string;
        };
        Returns: {
          desktop_session_id: string;
          user_id: string;
        }[];
      };
      revoke_certificate_with_audit: {
        Args: {
          input_admin_user_id: string;
          input_certificate_id: string;
          input_reason: string;
        };
        Returns: string;
      };
      get_paid_total: {
        Args: { input_user_id: string };
        Returns: number;
      };
    };
    CompositeTypes: Record<never, never>;
  };
};
