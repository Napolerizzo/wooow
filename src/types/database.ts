/**
 * Supabase database types — expanded in Phase 2 after schema creation.
 * These are placeholder types that will be replaced with generated types.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'> & {
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      conferences: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['conferences']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['conferences']['Insert']>;
      };
      committees: {
        Row: {
          id: string;
          conference_id: string;
          name: string;
          access_code: string;
          access_code_hash: string;
          is_locked: boolean;
          locked_at: string | null;
          locked_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['committees']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['committees']['Insert']>;
      };
      eb_members: {
        Row: {
          id: string;
          committee_id: string;
          user_id: string | null;
          guest_name: string | null;
          role: string;
          is_owner: boolean;
          joined_at: string;
        };
        Insert: Omit<Database['public']['Tables']['eb_members']['Row'], 'id' | 'joined_at'> & {
          id?: string;
          joined_at?: string;
        };
        Update: Partial<Database['public']['Tables']['eb_members']['Insert']>;
      };
      delegates: {
        Row: {
          id: string;
          committee_id: string;
          name: string;
          country: string | null;
          portfolio: string | null;
          roll_call_status: 'present' | 'present_and_voting' | 'absent' | null;
          verbatim: string | null;
          eb_remarks: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['delegates']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['delegates']['Insert']>;
      };
      marking_schema: {
        Row: {
          id: string;
          committee_id: string;
          field_name: string;
          field_type: 'speech' | 'chit' | 'poi' | 'poi_reply' | 'documentation' | 'roll_call' | 'custom';
          max_score: number;
          scoring_mode: 'absolute' | 'average';
          max_items_total: number | null;
          max_items_count: number | null;
          sub_criteria: Json | null;
          sort_order: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['marking_schema']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['marking_schema']['Insert']>;
      };
      marks: {
        Row: {
          id: string;
          delegate_id: string;
          schema_field_id: string;
          committee_id: string;
          item_index: number;
          sub_criterion: string | null;
          score: number;
          counts_toward_final: boolean;
          marked_by: string | null;
          marked_by_guest_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['marks']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['marks']['Insert']>;
      };
      mark_edits: {
        Row: {
          id: string;
          mark_id: string;
          committee_id: string;
          edited_by: string | null;
          edited_by_guest_name: string | null;
          old_score: number;
          new_score: number;
          edited_at: string;
          note: string | null;
        };
        Insert: Omit<Database['public']['Tables']['mark_edits']['Row'], 'id' | 'edited_at'> & {
          id?: string;
          edited_at?: string;
        };
        Update: never; // Append-only — no updates allowed
      };
      final_marksheets: {
        Row: {
          id: string;
          committee_id: string;
          computed_at: string;
          computed_by: string | null;
          computed_by_guest_name: string | null;
          delegate_rankings: Json;
          award_assignments: Json;
          is_edited_after_lock: boolean;
          last_edited_at: string | null;
          last_edited_by_name: string | null;
        };
        Insert: Omit<Database['public']['Tables']['final_marksheets']['Row'], 'id'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['final_marksheets']['Insert']>;
      };
      award_tiers: {
        Row: {
          id: string;
          committee_id: string;
          tier_name: string;
          num_awards: number;
          rank_from: number;
          sort_order: number;
        };
        Insert: Omit<Database['public']['Tables']['award_tiers']['Row'], 'id'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['award_tiers']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
