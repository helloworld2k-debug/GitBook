export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Enums: {
      certificate_status: "active" | "revoked" | "generation_failed";
      certificate_type: "donation" | "honor";
      donation_provider: "stripe" | "paypal" | "manual";
      donation_status: "pending" | "paid" | "cancelled" | "failed" | "refunded";
      software_release_platform: "macos" | "windows";
    };
    Tables: {
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
