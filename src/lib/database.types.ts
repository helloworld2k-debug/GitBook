export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Enums: {
      certificate_status: "active" | "revoked" | "generation_failed";
      certificate_type: "donation" | "honor";
      donation_provider: "stripe" | "paypal" | "manual";
      donation_status: "pending" | "paid" | "cancelled" | "failed" | "refunded";
    };
    Tables: {
      profiles: {
        Row: { id: string; email: string; is_admin: boolean };
        Insert: { id: string; email: string; is_admin?: boolean };
        Update: { id?: string; email?: string; is_admin?: boolean };
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
        Row: { id: string; code: string };
        Insert: { id?: string; code: string };
        Update: { id?: string; code?: string };
        Relationships: [];
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
        };
        Insert: {
          id?: string;
          certificate_number: string;
          user_id: string;
          donation_id?: string | null;
          sponsor_level_id?: string | null;
          type: Database["public"]["Enums"]["certificate_type"];
          status?: Database["public"]["Enums"]["certificate_status"];
        };
        Update: {
          id?: string;
          certificate_number?: string;
          user_id?: string;
          donation_id?: string | null;
          sponsor_level_id?: string | null;
          type?: Database["public"]["Enums"]["certificate_type"];
          status?: Database["public"]["Enums"]["certificate_status"];
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      allocate_certificate_number: {
        Args: { input_type: Database["public"]["Enums"]["certificate_type"] };
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
