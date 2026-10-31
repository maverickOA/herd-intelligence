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
      animal_candidate_sires: {
        Row: {
          child_id: string
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          sire_id: string
        }
        Insert: {
          child_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          sire_id: string
        }
        Update: {
          child_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          sire_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "animal_candidate_sires_child_id_org_id_fkey"
            columns: ["child_id", "org_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "animal_candidate_sires_sire_id_org_id_fkey"
            columns: ["sire_id", "org_id"]
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
      assessment_overrides: {
        Row: {
          approved_by: string
          approver_role: Database["public"]["Enums"]["member_role"]
          assessment_id: string
          created_at: string
          id: string
          org_id: string
          reason: string
        }
        Insert: {
          approved_by?: string
          approver_role: Database["public"]["Enums"]["member_role"]
          assessment_id: string
          created_at?: string
          id?: string
          org_id: string
          reason: string
        }
        Update: {
          approved_by?: string
          approver_role?: Database["public"]["Enums"]["member_role"]
          assessment_id?: string
          created_at?: string
          id?: string
          org_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_overrides_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "breeding_assessments"
            referencedColumns: ["id"]
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
      birth_events: {
        Row: {
          assisted: boolean
          born_on: string
          created_at: string
          created_by: string | null
          dam_id: string
          farm_id: string
          id: string
          mating_id: string | null
          notes: string | null
          org_id: string
          row_seq: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          assisted?: boolean
          born_on: string
          created_at?: string
          created_by?: string | null
          dam_id: string
          farm_id: string
          id?: string
          mating_id?: string | null
          notes?: string | null
          org_id: string
          row_seq?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          assisted?: boolean
          born_on?: string
          created_at?: string
          created_by?: string | null
          dam_id?: string
          farm_id?: string
          id?: string
          mating_id?: string | null
          notes?: string | null
          org_id?: string
          row_seq?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "birth_events_dam_id_org_id_fkey"
            columns: ["dam_id", "org_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "birth_events_farm_id_org_id_fkey"
            columns: ["farm_id", "org_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "birth_events_mating_id_org_id_fkey"
            columns: ["mating_id", "org_id"]
            isOneToOne: false
            referencedRelation: "mating_events"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      birth_offspring: {
        Row: {
          animal_id: string | null
          birth_id: string
          birth_weight_kg: number | null
          born_alive: boolean
          id: string
          org_id: string
          position: number
          sex: Database["public"]["Enums"]["animal_sex"] | null
        }
        Insert: {
          animal_id?: string | null
          birth_id: string
          birth_weight_kg?: number | null
          born_alive: boolean
          id?: string
          org_id: string
          position: number
          sex?: Database["public"]["Enums"]["animal_sex"] | null
        }
        Update: {
          animal_id?: string | null
          birth_id?: string
          birth_weight_kg?: number | null
          born_alive?: boolean
          id?: string
          org_id?: string
          position?: number
          sex?: Database["public"]["Enums"]["animal_sex"] | null
        }
        Relationships: [
          {
            foreignKeyName: "birth_offspring_animal_id_org_id_fkey"
            columns: ["animal_id", "org_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "birth_offspring_birth_id_org_id_fkey"
            columns: ["birth_id", "org_id"]
            isOneToOne: false
            referencedRelation: "birth_events"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      breeding_assessments: {
        Row: {
          buck_id: string
          classification: Database["public"]["Enums"]["breeding_class"]
          classified_coi: number
          completeness: number
          created_at: string
          doe_id: string
          engine_version: string
          id: string
          known_coi: number
          org_id: string
          pedigree_hash: string
          pedigree_revision: number
          policy: Json
          policy_id: string
          policy_version: number
          possible: boolean
          purpose: string
          relationships: string[]
          requested_by: string
          requires_override: boolean
          result: Json
          uses_founder_assumption: boolean
          verified_coi: number
          worst_case_coi: number | null
        }
        Insert: {
          buck_id: string
          classification: Database["public"]["Enums"]["breeding_class"]
          classified_coi: number
          completeness: number
          created_at?: string
          doe_id: string
          engine_version: string
          id?: string
          known_coi: number
          org_id: string
          pedigree_hash: string
          pedigree_revision: number
          policy: Json
          policy_id: string
          policy_version: number
          possible: boolean
          purpose: string
          relationships?: string[]
          requested_by: string
          requires_override: boolean
          result: Json
          uses_founder_assumption: boolean
          verified_coi: number
          worst_case_coi?: number | null
        }
        Update: {
          buck_id?: string
          classification?: Database["public"]["Enums"]["breeding_class"]
          classified_coi?: number
          completeness?: number
          created_at?: string
          doe_id?: string
          engine_version?: string
          id?: string
          known_coi?: number
          org_id?: string
          pedigree_hash?: string
          pedigree_revision?: number
          policy?: Json
          policy_id?: string
          policy_version?: number
          possible?: boolean
          purpose?: string
          relationships?: string[]
          requested_by?: string
          requires_override?: boolean
          result?: Json
          uses_founder_assumption?: boolean
          verified_coi?: number
          worst_case_coi?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "breeding_assessments_buck_id_org_id_fkey"
            columns: ["buck_id", "org_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "breeding_assessments_doe_id_org_id_fkey"
            columns: ["doe_id", "org_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "breeding_assessments_policy_id_org_id_fkey"
            columns: ["policy_id", "org_id"]
            isOneToOne: false
            referencedRelation: "breeding_policies"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      breeding_policies: {
        Row: {
          advisor_confirmed_on: string | null
          advisor_name: string | null
          advisor_note: string | null
          allow_founder_assumption: boolean
          blocked_relationships: string[]
          created_at: string
          created_by: string | null
          generations: number
          high_band_min: number
          id: string
          low_band_max: number
          max_coi: number
          min_completeness: number
          org_id: string
          row_seq: number
          species_code: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          advisor_confirmed_on?: string | null
          advisor_name?: string | null
          advisor_note?: string | null
          allow_founder_assumption?: boolean
          blocked_relationships?: string[]
          created_at?: string
          created_by?: string | null
          generations?: number
          high_band_min?: number
          id?: string
          low_band_max?: number
          max_coi?: number
          min_completeness?: number
          org_id: string
          row_seq?: number
          species_code: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          advisor_confirmed_on?: string | null
          advisor_name?: string | null
          advisor_note?: string | null
          allow_founder_assumption?: boolean
          blocked_relationships?: string[]
          created_at?: string
          created_by?: string | null
          generations?: number
          high_band_min?: number
          id?: string
          low_band_max?: number
          max_coi?: number
          min_completeness?: number
          org_id?: string
          row_seq?: number
          species_code?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "breeding_policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breeding_policies_species_code_fkey"
            columns: ["species_code"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["code"]
          },
        ]
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
      mating_event_sires: {
        Row: {
          assessment_id: string
          id: string
          mating_id: string
          org_id: string
          override_id: string | null
          sire_id: string
        }
        Insert: {
          assessment_id: string
          id?: string
          mating_id: string
          org_id: string
          override_id?: string | null
          sire_id: string
        }
        Update: {
          assessment_id?: string
          id?: string
          mating_id?: string
          org_id?: string
          override_id?: string | null
          sire_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mating_event_sires_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "breeding_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mating_event_sires_mating_id_org_id_fkey"
            columns: ["mating_id", "org_id"]
            isOneToOne: false
            referencedRelation: "mating_events"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "mating_event_sires_override_id_fkey"
            columns: ["override_id"]
            isOneToOne: false
            referencedRelation: "assessment_overrides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mating_event_sires_sire_id_org_id_fkey"
            columns: ["sire_id", "org_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      mating_events: {
        Row: {
          created_at: string
          created_by: string | null
          dam_id: string
          ended_on: string | null
          farm_id: string
          id: string
          method: Database["public"]["Enums"]["mating_method"]
          notes: string | null
          org_id: string
          outcome: Database["public"]["Enums"]["mating_outcome"]
          risk_acknowledged: boolean
          row_seq: number
          started_on: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dam_id: string
          ended_on?: string | null
          farm_id: string
          id?: string
          method: Database["public"]["Enums"]["mating_method"]
          notes?: string | null
          org_id: string
          outcome?: Database["public"]["Enums"]["mating_outcome"]
          risk_acknowledged?: boolean
          row_seq?: number
          started_on: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dam_id?: string
          ended_on?: string | null
          farm_id?: string
          id?: string
          method?: Database["public"]["Enums"]["mating_method"]
          notes?: string | null
          org_id?: string
          outcome?: Database["public"]["Enums"]["mating_outcome"]
          risk_acknowledged?: boolean
          row_seq?: number
          started_on?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "mating_events_dam_id_org_id_fkey"
            columns: ["dam_id", "org_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "mating_events_farm_id_org_id_fkey"
            columns: ["farm_id", "org_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id", "org_id"]
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
      pregnancy_checks: {
        Row: {
          checked_on: string
          created_at: string
          created_by: string | null
          dam_id: string
          due_on: string | null
          farm_id: string
          id: string
          mating_id: string | null
          method: Database["public"]["Enums"]["pregnancy_method"]
          notes: string | null
          org_id: string
          result: Database["public"]["Enums"]["pregnancy_result"]
          row_seq: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          checked_on: string
          created_at?: string
          created_by?: string | null
          dam_id: string
          due_on?: string | null
          farm_id: string
          id?: string
          mating_id?: string | null
          method: Database["public"]["Enums"]["pregnancy_method"]
          notes?: string | null
          org_id: string
          result: Database["public"]["Enums"]["pregnancy_result"]
          row_seq?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          checked_on?: string
          created_at?: string
          created_by?: string | null
          dam_id?: string
          due_on?: string | null
          farm_id?: string
          id?: string
          mating_id?: string | null
          method?: Database["public"]["Enums"]["pregnancy_method"]
          notes?: string | null
          org_id?: string
          result?: Database["public"]["Enums"]["pregnancy_result"]
          row_seq?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "pregnancy_checks_dam_id_org_id_fkey"
            columns: ["dam_id", "org_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "pregnancy_checks_farm_id_org_id_fkey"
            columns: ["farm_id", "org_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "pregnancy_checks_mating_id_org_id_fkey"
            columns: ["mating_id", "org_id"]
            isOneToOne: false
            referencedRelation: "mating_events"
            referencedColumns: ["id", "org_id"]
          },
        ]
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
      breeding_pedigree: {
        Args: { p_animals: string[]; p_with_bucks?: boolean }
        Returns: Json
      }
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
      record_mating: {
        Args: {
          p_dam: string
          p_ended_on: string | null
          p_id?: string
          p_method: Database["public"]["Enums"]["mating_method"]
          p_notes?: string
          p_override_reason?: string
          p_risk_acknowledged?: boolean
          p_sires: Json
          p_started_on: string
        }
        Returns: string
      }
      record_pregnancy_check: {
        Args: {
          p_checked_on: string
          p_dam: string
          p_due_on?: string
          p_id?: string
          p_mating: string | null
          p_method: Database["public"]["Enums"]["pregnancy_method"]
          p_notes?: string
          p_result: Database["public"]["Enums"]["pregnancy_result"]
        }
        Returns: string
      }
      register_birth: {
        Args: {
          p_assisted?: boolean
          p_breed?: string
          p_born_on: string
          p_dam: string
          p_dam_confidence?: Database["public"]["Enums"]["parent_confidence"]
          p_id?: string
          p_kids: Json
          p_mating: string | null
          p_notes?: string
          p_sire?: string
          p_sire_confidence?: Database["public"]["Enums"]["parent_confidence"]
        }
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
      breeding_class: "low" | "elevated" | "insufficient" | "high" | "restricted"
      mating_method: "pasture" | "hand" | "ai"
      mating_outcome: "awaiting_check" | "pregnant" | "not_pregnant" | "kidded"
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
      pregnancy_method: "ultrasound" | "blood_test" | "observation"
      pregnancy_result: "pregnant" | "not_pregnant" | "unsure"
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
      breeding_class: ["low", "elevated", "insufficient", "high", "restricted"],
      mating_method: ["pasture", "hand", "ai"],
      mating_outcome: ["awaiting_check", "pregnant", "not_pregnant", "kidded"],
      member_role: ["owner", "manager", "worker", "vet"],
      member_status: ["active", "suspended"],
      parent_confidence: ["dna", "observed", "reported", "assumed"],
      parent_role: ["sire", "dam"],
      pen_type: ["pen", "paddock", "kidding", "quarantine", "pasture", "other"],
      pregnancy_method: ["ultrasound", "blood_test", "observation"],
      pregnancy_result: ["pregnant", "not_pregnant", "unsure"],
    },
  },
} as const
