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
      carry_over_decisions: {
        Row: {
          annual_days_remaining: number
          created_at: string | null
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          id: string
          project_id: string
          user_id: string
          year: number
        }
        Insert: {
          annual_days_remaining: number
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          id?: string
          project_id: string
          user_id: string
          year: number
        }
        Update: {
          annual_days_remaining?: number
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          id?: string
          project_id?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "carry_over_decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carry_over_decisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carry_over_decisions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          grant_system_admin: boolean
          id: string
          project_id: string | null
          role: Database["public"]["Enums"]["project_role"]
          sent_by: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          grant_system_admin?: boolean
          id?: string
          project_id?: string | null
          role?: Database["public"]["Enums"]["project_role"]
          sent_by?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          grant_system_admin?: boolean
          id?: string
          project_id?: string | null
          role?: Database["public"]["Enums"]["project_role"]
          sent_by?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_request_history: {
        Row: {
          action: string
          created_at: string | null
          id: string
          performed_by: string | null
          request_id: string
          snapshot: Json | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          performed_by?: string | null
          request_id: string
          snapshot?: Json | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          performed_by?: string | null
          request_id?: string
          snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_request_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_request_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approval_forward_sent_at: string | null
          attachment_url: string | null
          created_at: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          end_date: string
          id: string
          project_id: string
          reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          type: Database["public"]["Enums"]["leave_type"]
          updated_at: string | null
          user_id: string
          working_days_count: number
        }
        Insert: {
          approval_forward_sent_at?: string | null
          attachment_url?: string | null
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          end_date: string
          id?: string
          project_id: string
          reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          type: Database["public"]["Enums"]["leave_type"]
          updated_at?: string | null
          user_id: string
          working_days_count: number
        }
        Update: {
          approval_forward_sent_at?: string | null
          attachment_url?: string | null
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          end_date?: string
          id?: string
          project_id?: string
          reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          type?: Database["public"]["Enums"]["leave_type"]
          updated_at?: string | null
          user_id?: string
          working_days_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      national_holidays: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          description: string | null
          id: string
          is_recurring: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "national_holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          link: string | null
          message: string | null
          metadata: Json | null
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      annual_entitlement_grants: {
        Row: {
          created_at: string
          days_allocated: number
          definition_id: string | null
          grant_year: number | null
          id: string
          label: string
          project_id: string
          source: string
          updated_at: string
          user_id: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          days_allocated: number
          definition_id?: string | null
          grant_year?: number | null
          id?: string
          label?: string
          project_id: string
          source?: string
          updated_at?: string
          user_id: string
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          days_allocated?: number
          definition_id?: string | null
          grant_year?: number | null
          id?: string
          label?: string
          project_id?: string
          source?: string
          updated_at?: string
          user_id?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "annual_entitlement_grants_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "annual_fund_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annual_entitlement_grants_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annual_entitlement_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_request_grant_allocations: {
        Row: {
          created_at: string
          grant_id: string
          id: string
          leave_request_id: string
          working_days: number
        }
        Insert: {
          created_at?: string
          grant_id: string
          id?: string
          leave_request_id: string
          working_days: number
        }
        Update: {
          created_at?: string
          grant_id?: string
          id?: string
          leave_request_id?: string
          working_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_request_grant_allocations_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "annual_entitlement_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_request_grant_allocations_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      annual_fund_definitions: {
        Row: {
          created_at: string
          grant_year: number | null
          id: string
          label: string
          sort_order: number
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          grant_year?: number | null
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          grant_year?: number | null
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: []
      }
      project_members: {
        Row: {
          annual_leave_carried_over: number | null
          annual_leave_total: number | null
          annual_leave_used: number | null
          id: string
          joined_at: string | null
          project_id: string
          religious_leave_total: number | null
          religious_leave_used: number | null
          role: Database["public"]["Enums"]["project_role"]
          sick_leave_total: number | null
          sick_leave_used: number | null
          user_id: string
        }
        Insert: {
          annual_leave_carried_over?: number | null
          annual_leave_total?: number | null
          annual_leave_used?: number | null
          id?: string
          joined_at?: string | null
          project_id: string
          religious_leave_total?: number | null
          religious_leave_used?: number | null
          role?: Database["public"]["Enums"]["project_role"]
          sick_leave_total?: number | null
          sick_leave_used?: number | null
          user_id: string
        }
        Update: {
          annual_leave_carried_over?: number | null
          annual_leave_total?: number | null
          annual_leave_used?: number | null
          id?: string
          joined_at?: string | null
          project_id?: string
          religious_leave_total?: number | null
          religious_leave_used?: number | null
          role?: Database["public"]["Enums"]["project_role"]
          sick_leave_total?: number | null
          sick_leave_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          annual_accrual_day: number
          annual_accrual_month: number
          annual_first_use_by_day: number | null
          annual_first_use_by_month: number | null
          archived_at: string | null
          carry_over_policy:
            | Database["public"]["Enums"]["carry_over_policy"]
            | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_archived: boolean | null
          logo_url: string | null
          name: string
          slug: string
          updated_at: string | null
          vacation_threshold_percent: number | null
          year_reset_day: number | null
          year_reset_month: number | null
        }
        Insert: {
          annual_accrual_day?: number
          annual_accrual_month?: number
          annual_first_use_by_day?: number | null
          annual_first_use_by_month?: number | null
          archived_at?: string | null
          carry_over_policy?:
            | Database["public"]["Enums"]["carry_over_policy"]
            | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          logo_url?: string | null
          name: string
          slug?: string
          updated_at?: string | null
          vacation_threshold_percent?: number | null
          year_reset_day?: number | null
          year_reset_month?: number | null
        }
        Update: {
          annual_accrual_day?: number
          annual_accrual_month?: number
          annual_first_use_by_day?: number | null
          annual_first_use_by_month?: number | null
          archived_at?: string | null
          carry_over_policy?:
            | Database["public"]["Enums"]["carry_over_policy"]
            | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string | null
          vacation_threshold_percent?: number | null
          year_reset_day?: number | null
          year_reset_month?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      religious_holidays_pool: {
        Row: {
          category: Database["public"]["Enums"]["religion_category"]
          created_at: string | null
          created_by: string | null
          date: string
          description: string | null
          id: string
          is_recurring: boolean | null
          name: string
        }
        Insert: {
          category: Database["public"]["Enums"]["religion_category"]
          created_at?: string | null
          created_by?: string | null
          date: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          name: string
        }
        Update: {
          category?: Database["public"]["Enums"]["religion_category"]
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "religious_holidays_pool_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_annual_fund_definition_assignments: {
        Row: {
          created_at: string
          definition_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          definition_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          definition_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_annual_fund_definition_assignments_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "annual_fund_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_annual_fund_definition_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_religious_selections: {
        Row: {
          id: string
          religious_holiday_id: string
          selected_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          id?: string
          religious_holiday_id: string
          selected_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          id?: string
          religious_holiday_id?: string
          selected_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_religious_selections_religious_holiday_id_fkey"
            columns: ["religious_holiday_id"]
            isOneToOne: false
            referencedRelation: "religious_holidays_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_religious_selections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_leave_approval_forward_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          send_enabled: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          send_enabled?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          send_enabled?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_leave_approval_forward_emails_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_leave_balances: {
        Row: {
          annual_leave_carried_over: number | null
          annual_leave_total: number | null
          annual_leave_used: number | null
          religious_leave_total: number | null
          religious_leave_used: number | null
          sick_leave_total: number | null
          sick_leave_used: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          annual_leave_carried_over?: number | null
          annual_leave_total?: number | null
          annual_leave_used?: number | null
          religious_leave_total?: number | null
          religious_leave_used?: number | null
          sick_leave_total?: number | null
          sick_leave_used?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          annual_leave_carried_over?: number | null
          annual_leave_total?: number | null
          annual_leave_used?: number | null
          religious_leave_total?: number | null
          religious_leave_used?: number | null
          sick_leave_total?: number | null
          sick_leave_used?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_leave_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_conversations: {
        Row: {
          messages: Json
          pending_request: Json | null
          telegram_chat_id: string
          updated_at: string
        }
        Insert: {
          messages?: Json
          pending_request?: Json | null
          telegram_chat_id: string
          updated_at?: string
        }
        Update: {
          messages?: Json
          pending_request?: Json | null
          telegram_chat_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_connections: {
        Row: {
          id: string
          is_active: boolean
          linked_at: string
          telegram_chat_id: string
          telegram_user_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          linked_at?: string
          telegram_chat_id: string
          telegram_user_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          is_active?: boolean
          linked_at?: string
          telegram_chat_id?: string
          telegram_user_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_teams: {
        Row: {
          color: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["roadmap_team_kind"]
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["roadmap_team_kind"]
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["roadmap_team_kind"]
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      roadmap_team_members: {
        Row: {
          created_at: string
          id: string
          name: string
          role_label: string | null
          sort_order: number
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          role_label?: string | null
          sort_order?: number
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          role_label?: string | null
          sort_order?: number
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "roadmap_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_items: {
        Row: {
          created_at: string
          dependencies: string | null
          end_month: string | null
          id: string
          notes: string | null
          owner: string | null
          sort_order: number
          start_month: string | null
          status: Database["public"]["Enums"]["roadmap_item_status"]
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dependencies?: string | null
          end_month?: string | null
          id?: string
          notes?: string | null
          owner?: string | null
          sort_order?: number
          start_month?: string | null
          status?: Database["public"]["Enums"]["roadmap_item_status"]
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dependencies?: string | null
          end_month?: string | null
          id?: string
          notes?: string | null
          owner?: string | null
          sort_order?: number
          start_month?: string | null
          status?: Database["public"]["Enums"]["roadmap_item_status"]
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_items_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "roadmap_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          email_notifications_enabled: boolean
          id: string
          is_system_admin: boolean | null
          name: string
          phone_number: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          email_notifications_enabled?: boolean
          id: string
          is_system_admin?: boolean | null
          name: string
          phone_number?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          email_notifications_enabled?: boolean
          id?: string
          is_system_admin?: boolean | null
          name?: string
          phone_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_working_days: {
        Args: { p_end: string; p_start: string }
        Returns: number
      }
      check_vacation_overlap: {
        Args: {
          p_end: string
          p_exclude_request_id?: string
          p_project_id: string
          p_start: string
        }
        Returns: {
          overlapping_members: number
          overlapping_user_ids: string[]
          threshold_percent: number
          total_members: number
        }[]
      }
      is_project_admin: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      is_project_lead: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      is_system_admin: { Args: { p_user_id: string }; Returns: boolean }
    }
    Enums: {
      carry_over_policy: "ask" | "auto_transfer" | "auto_lose"
      leave_status: "pending" | "approved" | "rejected" | "cancelled"
      leave_type: "annual" | "sick" | "religious"
      notification_type:
        | "invite_received"
        | "request_submitted"
        | "request_approved"
        | "request_rejected"
        | "request_edited"
        | "religious_holiday_logged"
        | "carry_over_warning"
        | "project_added"
      project_role: "admin" | "lead" | "employee"
      roadmap_item_status: "completed" | "in_progress" | "planned" | "waiting"
      roadmap_team_kind: "engineering" | "bt" | "future"
      religion_category:
        | "islam"
        | "christianity_catholic"
        | "christianity_orthodox"
        | "judaism"
        | "hinduism"
        | "buddhism"
        | "other"
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
      carry_over_policy: ["ask", "auto_transfer", "auto_lose"],
      leave_status: ["pending", "approved", "rejected", "cancelled"],
      leave_type: ["annual", "sick", "religious"],
      notification_type: [
        "invite_received",
        "request_submitted",
        "request_approved",
        "request_rejected",
        "request_edited",
        "religious_holiday_logged",
        "carry_over_warning",
        "project_added",
      ],
      project_role: ["admin", "lead", "employee"],
      religion_category: [
        "islam",
        "christianity_catholic",
        "christianity_orthodox",
        "judaism",
        "hinduism",
        "buddhism",
        "other",
      ],
    },
  },
} as const
