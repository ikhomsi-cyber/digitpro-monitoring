export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      expense_notes: {
        Row: {
          id: string;
          user_id: string;
          transaction_id: string;
          tag: "note_de_frais" | "repas_client";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          transaction_id: string;
          tag: "note_de_frais" | "repas_client";
        };
        Update: Partial<{
          transaction_id: string;
          tag: "note_de_frais" | "repas_client";
        }>;
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          date: string; // YYYY-MM-DD
          label: string;
          category: string;
          amount: number;
          balance: number | null;
          company: string;
          /** Périmètre : pro (SASU) vs personal (privé). */
          scope: "pro" | "personal";
          content_hash: string | null;
          import_session_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          date: string;
          label: string;
          category: string;
          amount: number;
          balance?: number | null;
          company?: string;
          scope?: "pro" | "personal";
          content_hash?: string | null;
          import_session_id?: string | null;
        };
        Update: Partial<{
          date: string;
          label: string;
          category: string;
          amount: number;
          balance: number | null;
          company: string;
          scope: "pro" | "personal";
          content_hash: string | null;
          import_session_id: string | null;
        }>;
        Relationships: [];
      };
      import_sessions: {
        Row: {
          id: string;
          user_id: string;
          source_filename: string | null;
          file_hash: string | null;
          format: string;
          row_count: number;
          inserted_count: number;
          skipped_duplicate_count: number;
          merged_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          source_filename?: string | null;
          file_hash?: string | null;
          format: string;
          row_count?: number;
          inserted_count?: number;
          skipped_duplicate_count?: number;
          merged_count?: number;
        };
        Update: Partial<{
          source_filename: string | null;
          file_hash: string | null;
          format: string;
          row_count: number;
          inserted_count: number;
          skipped_duplicate_count: number;
          merged_count: number;
        }>;
        Relationships: [];
      };
      salary_simulations: {
        Row: {
          id: string;
          user_id: string;
          salary_net: number;
          company_cost_estimate: number;
          cash_available_at_time: number;
          remaining_cash_estimate: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          salary_net: number;
          company_cost_estimate: number;
          cash_available_at_time: number;
          remaining_cash_estimate: number;
        };
        Update: Partial<{
          salary_net: number;
          company_cost_estimate: number;
          cash_available_at_time: number;
          remaining_cash_estimate: number;
        }>;
        Relationships: [];
      };
      monthly_metrics: {
        Row: {
          id: string;
          user_id: string;
          month: string; // YYYY-MM
          revenue: number;
          expenses: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          month: string;
          revenue: number;
          expenses: number;
        };
        Update: Partial<{
          revenue: number;
          expenses: number;
        }>;
        Relationships: [];
      };
      user_billable_settings: {
        Row: {
          user_id: string;
          tjm_ht: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          tjm_ht?: number;
        };
        Update: Partial<{
          tjm_ht: number;
        }>;
        Relationships: [];
      };
      billable_work_days: {
        Row: {
          id: string;
          user_id: string;
          work_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          work_date: string;
        };
        Update: Partial<{
          work_date: string;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

