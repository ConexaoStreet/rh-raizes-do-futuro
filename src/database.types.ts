export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      absence_justifications: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string
          employee_id: string
          id: string
          member_id: string
          reason: string
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string
          employee_id: string
          id?: string
          member_id: string
          reason: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string
          employee_id?: string
          id?: string
          member_id?: string
          reason?: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "absence_justifications_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "justification_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_justifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_justifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_justifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "attendance_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_justifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          archived: boolean
          bucket: string
          created_at: string
          created_by: string
          employee_id: string | null
          feedback_id: string | null
          filename: string
          id: string
          justification_id: string | null
          mime_type: string
          path: string
          size_bytes: number
        }
        Insert: {
          archived?: boolean
          bucket: string
          created_at?: string
          created_by?: string
          employee_id?: string | null
          feedback_id?: string | null
          filename: string
          id?: string
          justification_id?: string | null
          mime_type: string
          path: string
          size_bytes: number
        }
        Update: {
          archived?: boolean
          bucket?: string
          created_at?: string
          created_by?: string
          employee_id?: string | null
          feedback_id?: string | null
          filename?: string
          id?: string
          justification_id?: string | null
          mime_type?: string
          path?: string
          size_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "attachments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedbacks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_justification_id_fkey"
            columns: ["justification_id"]
            isOneToOne: false
            referencedRelation: "absence_justifications"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_maintenance: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          id: string
          opened_at: string
          opened_by: string
          reason: string
          session_id: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          id?: string
          opened_at?: string
          opened_by: string
          reason: string
          session_id: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          id?: string
          opened_at?: string
          opened_by?: string
          reason?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_maintenance_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_maintenance_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_maintenance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_members: {
        Row: {
          actual_arrival: string | null
          actual_departure: string | null
          created_at: string
          delay_minutes: number | null
          early_minutes: number | null
          employee_id: string
          expected_arrival: string
          expected_departure: string
          full_name_snapshot: string
          id: string
          notes: string
          registration_snapshot: string
          session_id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          actual_arrival?: string | null
          actual_departure?: string | null
          created_at?: string
          delay_minutes?: number | null
          early_minutes?: number | null
          employee_id: string
          expected_arrival: string
          expected_departure: string
          full_name_snapshot: string
          id?: string
          notes?: string
          registration_snapshot: string
          session_id: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          actual_arrival?: string | null
          actual_departure?: string | null
          created_at?: string
          delay_minutes?: number | null
          early_minutes?: number | null
          employee_id?: string
          expected_arrival?: string
          expected_departure?: string
          full_name_snapshot?: string
          id?: string
          notes?: string
          registration_snapshot?: string
          session_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_members_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          class_id: string
          created_at: string
          finalization_reason: string | null
          finalized_at: string | null
          finalized_by: string | null
          id: string
          opened_at: string
          opened_by: string
          original_member_count: number
          scheduled_date: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          class_id: string
          created_at?: string
          finalization_reason?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          opened_at?: string
          opened_by: string
          original_member_count?: number
          scheduled_date: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          class_id?: string
          created_at?: string
          finalization_reason?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          opened_at?: string
          opened_by?: string
          original_member_count?: number
          scheduled_date?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_name: string | null
          actor_roles: string[] | null
          actor_user_id: string | null
          context: Json
          created_at: string
          entity_id: string | null
          event_type: string
          id: string
          module: string
          new_values: Json | null
          old_values: Json | null
          severity: string
          success: boolean
        }
        Insert: {
          action: string
          actor_name?: string | null
          actor_roles?: string[] | null
          actor_user_id?: string | null
          context?: Json
          created_at?: string
          entity_id?: string | null
          event_type?: string
          id?: string
          module: string
          new_values?: Json | null
          old_values?: Json | null
          severity?: string
          success?: boolean
        }
        Update: {
          action?: string
          actor_name?: string | null
          actor_roles?: string[] | null
          actor_user_id?: string | null
          context?: Json
          created_at?: string
          entity_id?: string | null
          event_type?: string
          id?: string
          module?: string
          new_values?: Json | null
          old_values?: Json | null
          severity?: string
          success?: boolean
        }
        Relationships: []
      }
      classes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      course_calendar: {
        Row: {
          class_id: string | null
          created_at: string
          has_course: boolean
          id: string
          kind: string
          reason: string
          scheduled_date: string
          updated_at: string
          version: number
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          has_course?: boolean
          id?: string
          kind: string
          reason: string
          scheduled_date: string
          updated_at?: string
          version?: number
        }
        Update: {
          class_id?: string | null
          created_at?: string
          has_course?: boolean
          id?: string
          kind?: string
          reason?: string
          scheduled_date?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_calendar_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      employee_admin_notes: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          notes: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          notes?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_admin_notes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          access_role_code: string
          class_id: string | null
          created_at: string
          department_id: string | null
          email: string | null
          expected_arrival: string
          expected_departure: string
          full_name: string
          id: string
          job_position_id: string | null
          join_date: string
          manager_id: string | null
          member_group: string
          phone: string | null
          photo_path: string | null
          profile_id: string | null
          registration: string
          social_name: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          access_role_code?: string
          class_id?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          expected_arrival?: string
          expected_departure?: string
          full_name: string
          id?: string
          job_position_id?: string | null
          join_date?: string
          manager_id?: string | null
          member_group?: string
          phone?: string | null
          photo_path?: string | null
          profile_id?: string | null
          registration: string
          social_name?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          access_role_code?: string
          class_id?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          expected_arrival?: string
          expected_departure?: string
          full_name?: string
          id?: string
          job_position_id?: string | null
          join_date?: string
          manager_id?: string | null
          member_group?: string
          phone?: string | null
          photo_path?: string | null
          profile_id?: string | null
          registration?: string
          social_name?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "employees_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "job_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          class_id: string | null
          created_at: string
          description: string
          event_date: string
          id: string
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          description?: string
          event_date: string
          id?: string
          status?: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          class_id?: string | null
          created_at?: string
          description?: string
          event_date?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_followups: {
        Row: {
          author_id: string
          body: string
          created_at: string
          feedback_id: string
          id: string
        }
        Insert: {
          author_id?: string
          body: string
          created_at?: string
          feedback_id: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          feedback_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_followups_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_followups_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedbacks"
            referencedColumns: ["id"]
          },
        ]
      }
      feedbacks: {
        Row: {
          actions: string
          allow_response: boolean
          author_id: string
          created_at: string
          description: string
          due_date: string | null
          employee_id: string
          id: string
          improvements: string
          kind: string
          read_at: string | null
          released: boolean
          status: string
          strengths: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          actions?: string
          allow_response?: boolean
          author_id?: string
          created_at?: string
          description: string
          due_date?: string | null
          employee_id: string
          id?: string
          improvements?: string
          kind: string
          read_at?: string | null
          released?: boolean
          status?: string
          strengths?: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          actions?: string
          allow_response?: boolean
          author_id?: string
          created_at?: string
          description?: string
          due_date?: string | null
          employee_id?: string
          id?: string
          improvements?: string
          kind?: string
          read_at?: string | null
          released?: boolean
          status?: string
          strengths?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      job_positions: {
        Row: {
          active: boolean
          created_at: string
          description: string
          id: string
          name: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          name: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          name?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      justification_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      manager_activation_invites: {
        Row: {
          attempts: number
          claimed_by: string | null
          code_hash: string
          created_at: string
          employee_id: string
          expires_at: string
          id: string
          locked_at: string | null
          max_attempts: number
          updated_at: string
          used_at: string | null
        }
        Insert: {
          attempts?: number
          claimed_by?: string | null
          code_hash: string
          created_at?: string
          employee_id: string
          expires_at: string
          id?: string
          locked_at?: string | null
          max_attempts?: number
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          attempts?: number
          claimed_by?: string | null
          code_hash?: string
          created_at?: string
          employee_id?: string
          expires_at?: string
          id?: string
          locked_at?: string | null
          max_attempts?: number
          updated_at?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manager_activation_invites_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_cycle_criteria: {
        Row: {
          criterion_id: string
          cycle_id: string
          name_snapshot: string
        }
        Insert: {
          criterion_id: string
          cycle_id: string
          name_snapshot: string
        }
        Update: {
          criterion_id?: string
          cycle_id?: string
          name_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_cycle_criteria_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "manager_review_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_cycle_criteria_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "manager_review_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_cycle_targets: {
        Row: {
          cycle_id: string
          manager_id: string
        }
        Insert: {
          cycle_id: string
          manager_id: string
        }
        Update: {
          cycle_id?: string
          manager_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_cycle_targets_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "manager_review_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_cycle_targets_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_review_criteria: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      manager_review_cycles: {
        Row: {
          created_at: string
          description: string
          end_date: string
          id: string
          minimum_responses: number
          start_date: string
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          description?: string
          end_date: string
          id?: string
          minimum_responses?: number
          start_date: string
          status?: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          description?: string
          end_date?: string
          id?: string
          minimum_responses?: number
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      managers: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          profile_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name: string
          id?: string
          profile_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          profile_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "managers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          path: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          path?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          path?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_criteria: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          updated_at: string
          version: number
          weight: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          version?: number
          weight?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          version?: number
          weight?: number
        }
        Relationships: []
      }
      performance_cycles: {
        Row: {
          created_at: string
          end_date: string
          id: string
          start_date: string
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          start_date: string
          status?: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      performance_reviews: {
        Row: {
          created_at: string
          cycle_id: string
          employee_id: string
          id: string
          notes: string
          released: boolean
          reviewer_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          cycle_id: string
          employee_id: string
          id?: string
          notes?: string
          released?: boolean
          reviewer_id?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          cycle_id?: string
          employee_id?: string
          id?: string
          notes?: string
          released?: boolean
          reviewer_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "performance_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_scores: {
        Row: {
          criterion_id: string
          criterion_name: string
          id: string
          review_id: string
          score: number
          weight: number
        }
        Insert: {
          criterion_id: string
          criterion_name: string
          id?: string
          review_id: string
          score: number
          weight: number
        }
        Update: {
          criterion_id?: string
          criterion_name?: string
          id?: string
          review_id?: string
          score?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_scores_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "performance_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_scores_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "performance_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          id: string
          module: string
          name: string
        }
        Insert: {
          code: string
          id?: string
          module: string
          name: string
        }
        Update: {
          code?: string
          id?: string
          module?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          last_seen_at: string | null
          onboarded_at: string | null
          phone: string | null
          registration: string | null
          requested_class: string | null
          requested_department_id: string | null
          requested_role_code: string | null
          status: string
          terms_accepted_at: string | null
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          last_seen_at?: string | null
          onboarded_at?: string | null
          phone?: string | null
          registration?: string | null
          requested_class?: string | null
          requested_department_id?: string | null
          requested_role_code?: string | null
          status?: string
          terms_accepted_at?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          last_seen_at?: string | null
          onboarded_at?: string | null
          phone?: string | null
          registration?: string | null
          requested_class?: string | null
          requested_department_id?: string | null
          requested_role_code?: string | null
          status?: string
          terms_accepted_at?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_requested_department_id_fkey"
            columns: ["requested_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      push_config: {
        Row: {
          id: number
          updated_at: string
          vapid_private_key: string
          vapid_public_key: string
          webhook_secret: string
        }
        Insert: {
          id: number
          updated_at?: string
          vapid_private_key: string
          vapid_public_key: string
          webhook_secret: string
        }
        Update: {
          id?: number
          updated_at?: string
          vapid_private_key?: string
          vapid_public_key?: string
          webhook_secret?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      releases: {
        Row: {
          changes: string
          created_at: string
          id: string
          version: string
        }
        Insert: {
          changes: string
          created_at?: string
          id?: string
          version: string
        }
        Update: {
          changes?: string
          created_at?: string
          id?: string
          version?: string
        }
        Relationships: []
      }
      report_exports: {
        Row: {
          created_at: string
          created_by: string
          format: string
          id: string
          path: string
          report_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          format: string
          id?: string
          path: string
          report_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          format?: string
          id?: string
          path?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_exports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_exports_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          class_id: string | null
          created_at: string
          created_by: string
          employee_id: string | null
          id: string
          kind: string
          period_end: string
          period_start: string
          title: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          created_by?: string
          employee_id?: string | null
          id?: string
          kind: string
          period_end: string
          period_start: string
          title: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          created_by?: string
          employee_id?: string | null
          id?: string
          kind?: string
          period_end?: string
          period_start?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          active: boolean
          archived: boolean
          code: string
          created_at: string
          description: string
          id: string
          level: number
          name: string
          privileged: boolean
          scope: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          archived?: boolean
          code: string
          created_at?: string
          description?: string
          id?: string
          level?: number
          name: string
          privileged?: boolean
          scope?: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          archived?: boolean
          code?: string
          created_at?: string
          description?: string
          id?: string
          level?: number
          name?: string
          privileged?: boolean
          scope?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: Json
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
          version?: number
        }
        Relationships: []
      }
      ti_support_tickets: {
        Row: {
          attachment_path: string | null
          category: string
          created_at: string
          description: string
          id: string
          page_path: string
          page_title: string
          page_url: string
          status: string
          subject: string
          technical_context: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          attachment_path?: string | null
          category: string
          created_at?: string
          description: string
          id?: string
          page_path?: string
          page_title?: string
          page_url?: string
          status?: string
          subject: string
          technical_context?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          attachment_path?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          page_path?: string
          page_title?: string
          page_url?: string
          status?: string
          subject?: string
          technical_context?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ti_support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_history: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          id: string
          role_code: string
          role_id: string | null
          role_name: string
          source: string
          user_id: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          id?: string
          role_code: string
          role_id?: string | null
          role_name: string
          source?: string
          user_id: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          role_code?: string
          role_id?: string | null
          role_name?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_history_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          role_id: string
          user_id: string
        }
        Insert: {
          role_id: string
          user_id: string
        }
        Update: {
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_user: {
        Args: {
          employee_identifier: string
          reason: string
          user_identifier: string
        }
        Returns: undefined
      }
      archive_attachment: {
        Args: { identifier: string; reason: string }
        Returns: undefined
      }
      attach_file: { Args: { payload: Json }; Returns: string }
      authenticate_event: { Args: { action_name: string }; Returns: undefined }
      bootstrap: { Args: never; Returns: Json }
      complete_profile: { Args: { payload: Json }; Returns: undefined }
      course_status: {
        Args: { class_identifier: string; day: string }
        Returns: Json
      }
      dashboard_snapshot: {
        Args: { period_end: string; period_start: string }
        Returns: Json
      }
      end_maintenance: {
        Args: { session_identifier: string }
        Returns: undefined
      }
      expire_security_data: { Args: never; Returns: number }
      feedback_reply: {
        Args: { body?: string; identifier: string; mark_read?: boolean }
        Returns: undefined
      }
      finalize_attendance: {
        Args: { reason?: string; session_identifier: string }
        Returns: undefined
      }
      finalize_manager_activation: {
        Args: {
          email_value: string
          invite_identifier: string
          user_identifier: string
        }
        Returns: undefined
      }
      has_permission: { Args: { permission_code: string }; Returns: boolean }
      import_calendar: { Args: { rows: Json }; Returns: number }
      import_employees: { Args: { rows: Json }; Returns: number }
      issue_otp: {
        Args: {
          hash_value: string
          session_identifier: string
          user_identifier: string
        }
        Returns: Json
      }
      manage_user: {
        Args: {
          new_status: string
          reason: string
          role_identifiers: string[]
          user_identifier: string
        }
        Returns: undefined
      }
      manager_results: { Args: { cycle_identifier: string }; Returns: Json }
      mark_notification: { Args: { identifier: string }; Returns: undefined }
      my_review_tasks: { Args: never; Returns: Json }
      my_sessions: { Args: { target_user?: string }; Returns: Json }
      open_attendance: { Args: { class_identifier: string }; Returns: string }
      register_export: {
        Args: {
          file_path: string
          format_name: string
          report_identifier: string
        }
        Returns: string
      }
      register_push_subscription: {
        Args: {
          auth_value: string
          endpoint_value: string
          p256dh_value: string
          user_agent_value?: string
        }
        Returns: string
      }
      register_report: { Args: { payload: Json }; Returns: string }
      report_snapshot: {
        Args: {
          class_identifier?: string
          employee_identifier?: string
          period_end: string
          period_start: string
        }
        Returns: Json
      }
      review_justification: {
        Args: {
          decision: string
          expected_version: number
          identifier: string
          note: string
        }
        Returns: undefined
      }
      revoke_session: {
        Args: { session_identifier: string }
        Returns: undefined
      }
      save_attendance: {
        Args: { changes: Json; session_identifier: string }
        Returns: Json
      }
      save_entity: {
        Args: { entity: string; expected_version?: number; payload: Json }
        Returns: string
      }
      save_performance: {
        Args: {
          cycle_identifier: string
          employee_identifier: string
          expected_version?: number
          notes: string
          released: boolean
          scores: Json
        }
        Returns: string
      }
      save_review_cycle: {
        Args: {
          expected_version?: number
          manager_identifiers: string[]
          payload: Json
        }
        Returns: string
      }
      save_role: {
        Args: {
          expected_version: number
          payload: Json
          permission_identifiers: string[]
          reason: string
        }
        Returns: string
      }
      set_review_cycle_status: {
        Args: {
          expected_version: number
          identifier: string
          next_status: string
        }
        Returns: undefined
      }
      start_maintenance: {
        Args: { reason: string; session_identifier: string }
        Returns: string
      }
      submit_justification: {
        Args: {
          category_identifier: string
          member_identifier: string
          reason: string
        }
        Returns: string
      }
      submit_manager_review: {
        Args: {
          cycle_identifier: string
          improvements: string
          manager_identifier: string
          message: string
          scores: Json
          strengths: string
        }
        Returns: undefined
      }
      system_health: { Args: never; Returns: Json }
      unregister_push_subscription: {
        Args: { endpoint_value: string }
        Returns: undefined
      }
      verify_otp: {
        Args: {
          hash_value: string
          session_identifier: string
          user_identifier: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
