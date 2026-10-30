// Generated from the Supabase project schema. Regenerate after each migration
// (Supabase MCP generate_typescript_types, or `npx supabase gen types typescript --linked`).

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      animal_acquisitions: {
        Row: {
          acquired_on: string | null
          animal_id: string
          created_at: string
          created_by: string | null
          currency_code: string | null
          notes: string | null
          org_id: string
          price: number | null
          row_seq: number
          source: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          acquired_on?: string | null
          animal_id: string
          created_at?: string
          created_by?: string | null
          currency_code?: string | null
          notes?: string | null
          org_id: string
          price?: number | null
          row_seq?: number
          source?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          acquired_on?: string | null
          animal_id?: string
          created_at?: string
          created_by?: string | null
          currency_code?: string | null
          notes?: string | null
          org_id?: string
          price?: number | null
          row_seq?: number
          source?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "animal_acquisitions_animal_id_org_id_fkey"
            columns: ["animal_id", "org_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      animal_events: {
        Row: {
          actor: string | null
          animal_id: string
          details: Json | null
          event_type: string
          id: number
          occurred_at: string
          org_id: string
          summary: string
        }
        Insert: {
          actor?: string | null
          animal_id: string
          details?: Json | null
          event_type: string
          id?: never
          occurred_at?: string
          org_id: string
          summary: string
        }
        Update: {
          actor?: string | null
          animal_id?: string
          details?: Json | null
          event_type?: string
          id?: never
          occurred_at?: string
          org_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "animal_events_animal_id_org_id_fkey"
            columns: ["animal_id", "org_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      animal_parentage: {
        Row: {
          child_id: string
          confidence: Database["public"]["Enums"]["parent_confidence"]
          created_at: string
          created_by: string | null
          ended_at: string | null
          ended_by: string | null
          evidence: string | null
          id: string
          is_current: boolean
          org_id: string
          parent_id: string
          role: Database["public"]["Enums"]["parent_role"]
          row_seq: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          child_id: string
          confidence?: Database["public"]["Enums"]["parent_confidence"]
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          ended_by?: string | null
          evidence?: string | null
          id?: string
          is_current?: boolean
          org_id: string
          parent_id: string
          role: Database["public"]["Enums"]["parent_role"]
          row_seq?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          child_id?: string
          confidence?: Database["public"]["Enums"]["parent_confidence"]
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          ended_by?: string | null
          evidence?: string | null
          id?: string
          is_current?: boolean
          org_id?: string
          parent_id?: string
          role?: Database["public"]["Enums"]["parent_role"]
          row_seq?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "animal_parentage_child_id_org_id_fkey"
            columns: ["child_id", "org_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "animal_parentage_parent_id_org_id_fkey"
            columns: ["parent_id", "org_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      animals: {
        Row: {
          birth_date: string | null
          birth_date_estimated: boolean
          breed_id: string | null
          color: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          farm_id: string | null
          founder_note: string | null
          id: string
          is_declared_founder: boolean
          markings: string | null
          name: string | null
          notes: string | null
          org_id: string
          origin: Database["public"]["Enums"]["animal_origin"]
          pen_id: string | null
          registration_number: string | null
          row_seq: number
          sex: Database["public"]["Enums"]["animal_sex"]
          species_code: string
          status: Database["public"]["Enums"]["animal_status"]
          tag: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          birth_date?: string | null
          birth_date_estimated?: boolean
          breed_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id?: string | null
          founder_note?: string | null
          id?: string
          is_declared_founder?: boolean
          markings?: string | null
          name?: string | null
          notes?: string | null
          org_id: string
          origin: Database["public"]["Enums"]["animal_origin"]
          pen_id?: string | null
          registration_number?: string | null
          row_seq?: number
          sex: Database["public"]["Enums"]["animal_sex"]
          species_code?: string
          status?: Database["public"]["Enums"]["animal_status"]
          tag?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          birth_date?: string | null
          birth_date_estimated?: boolean
          breed_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id?: string | null
          founder_note?: string | null
          id?: string
          is_declared_founder?: boolean
          markings?: string | null
          name?: string | null
          notes?: string | null
          org_id?: string
          origin?: Database["public"]["Enums"]["animal_origin"]
          pen_id?: string | null
          registration_number?: string | null
          row_seq?: number
          sex?: Database["public"]["Enums"]["animal_sex"]
          species_code?: string
          status?: Database["public"]["Enums"]["animal_status"]
          tag?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "animals_breed_id_fkey"
            columns: ["breed_id"]
            isOneToOne: false
            referencedRelation: "breeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_farm_id_org_id_fkey"
            columns: ["farm_id", "org_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "animals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_pen_id_farm_id_fkey"
            columns: ["pen_id", "farm_id"]
            isOneToOne: false
            referencedRelation: "pens"
            referencedColumns: ["id", "farm_id"]
          },
          {
            foreignKeyName: "animals_species_code_fkey"
            columns: ["species_code"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["code"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          after: Json | null
          at: string
          before: Json | null
          id: number
          org_id: string | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          id?: never
          org_id?: string | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          id?: never
          org_id?: string | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      breeds: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string | null
          species_code: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id?: string | null
          species_code: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string | null
          species_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "breeds_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breeds_species_code_fkey"
            columns: ["species_code"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["code"]
          },
        ]
      }
      farm_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          farm_id: string
          id: string
          membership_id: string
          org_id: string
          row_seq: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          farm_id: string
          id?: string
          membership_id: string
          org_id: string
          row_seq?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          farm_id?: string
          id?: string
          membership_id?: string
          org_id?: string
          row_seq?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "farm_assignments_farm_id_org_id_fkey"
            columns: ["farm_id", "org_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "farm_assignments_membership_id_org_id_fkey"
            columns: ["membership_id", "org_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      farms: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          org_id: string
          row_seq: number
          timezone: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          org_id: string
          row_seq?: number
          timezone?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          org_id?: string
          row_seq?: number
          timezone?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "farms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          farm_ids: string[]
          id: string
          invited_by: string
          org_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["member_role"]
          row_seq: number
          token_hash: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          farm_ids?: string[]
          id?: string
          invited_by: string
          org_id: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["member_role"]
          row_seq?: number
          token_hash: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          farm_ids?: string[]
          id?: string
          invited_by?: string
          org_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          row_seq?: number
          token_hash?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invited_by: string | null
          org_id: string
          role: Database["public"]["Enums"]["member_role"]
          row_seq: number
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          updated_by: string | null
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invited_by?: string | null
          org_id: string
          role: Database["public"]["Enums"]["member_role"]
          row_seq?: number
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invited_by?: string | null
          org_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          row_seq?: number
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          country_code: string
          created_at: string
          created_by: string | null
          currency_code: string
          deleted_at: string | null
          id: string
          name: string
          row_seq: number
          timezone: string
          unit_system: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          country_code?: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          deleted_at?: string | null
          id?: string
          name: string
          row_seq?: number
          timezone?: string
          unit_system?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          country_code?: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          deleted_at?: string | null
          id?: string
          name?: string
          row_seq?: number
          timezone?: string
          unit_system?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      pedigree_revisions: {
        Row: {
          org_id: string
          revision: number
          updated_at: string
        }
        Insert: {
          org_id: string
          revision?: number
          updated_at?: string
        }
        Update: {
          org_id?: string
          revision?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedigree_revisions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pens: {
        Row: {
          capacity: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          farm_id: string
          id: string
          name: string
          org_id: string
          pen_type: Database["public"]["Enums"]["pen_type"]
          row_seq: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id: string
          id?: string
          name: string
          org_id: string
          pen_type?: Database["public"]["Enums"]["pen_type"]
          row_seq?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id?: string
          id?: string
          name?: string
          org_id?: string
          pen_type?: Database["public"]["Enums"]["pen_type"]
          row_seq?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "pens_farm_id_org_id_fkey"
            columns: ["farm_id", "org_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          row_seq: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          row_seq?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          row_seq?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      species: {
        Row: {
          birth_term: string
          code: string
          created_at: string
          female_term: string
          gestation_days: number
          male_term: string
          name: string
          young_term: string
        }
        Insert: {
          birth_term: string
          code: string
          created_at?: string
          female_term: string
          gestation_days: number
          male_term: string
          name: string
          young_term: string
        }
        Update: {
          birth_term?: string
          code?: string
          created_at?: string
          female_term?: string
          gestation_days?: number
          male_term?: string
          name?: string
          young_term?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      create_invitation: {
        Args: {
          p_email: string
          p_farm_ids?: string[]
          p_org: string
          p_role: Database["public"]["Enums"]["member_role"]
          p_valid_days?: number
        }
        Returns: string
      }
      create_organization: {
        Args: { p_first_farm_name?: string; p_name: string }
        Returns: string
      }
      set_parent: {
        Args: {
          p_child: string
          p_confidence?: Database["public"]["Enums"]["parent_confidence"]
          p_evidence?: string
          p_parent: string
          p_role: Database["public"]["Enums"]["parent_role"]
        }
        Returns: string
      }
    }
    Enums: {
      animal_origin: "born_on_farm" | "purchased" | "received" | "pedigree_only"
      animal_sex: "male" | "female"
      animal_status:
        | "active"
        | "breeding"
        | "pregnant"
        | "nursing"
        | "growing"
        | "quarantined"
        | "sold"
        | "deceased"
        | "culled"
      member_role: "owner" | "manager" | "worker" | "vet"
      member_status: "active" | "suspended"
      parent_confidence: "dna" | "observed" | "reported" | "assumed"
      parent_role: "sire" | "dam"
      pen_type:
        | "pen"
        | "paddock"
        | "kidding"
        | "quarantine"
        | "pasture"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T]

export const Constants = {
  public: {
    Enums: {
      animal_origin: ["born_on_farm", "purchased", "received", "pedigree_only"],
      animal_sex: ["male", "female"],
      animal_status: [
        "active",
        "breeding",
        "pregnant",
        "nursing",
        "growing",
        "quarantined",
        "sold",
        "deceased",
        "culled",
      ],
      member_role: ["owner", "manager", "worker", "vet"],
      member_status: ["active", "suspended"],
      parent_confidence: ["dna", "observed", "reported", "assumed"],
      parent_role: ["sire", "dam"],
      pen_type: ["pen", "paddock", "kidding", "quarantine", "pasture", "other"],
    },
  },
} as const
