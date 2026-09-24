export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export type Database = {
  public: {
    Tables: {
      absence_justifications: {
        Row: {
          id: string;
          member_id: string;
          employee_id: string;
          category_id: string | null;
          reason: string;
          status: string;
          review_comment: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          member_id: string;
          employee_id: string;
          category_id?: string | null;
          reason: string;
          status?: string;
          review_comment?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["absence_justifications"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "absence_justifications_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "justification_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "absence_justifications_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "absence_justifications_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "absence_justifications_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "attendance_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "absence_justifications_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      attachments: {
        Row: {
          id: string;
          employee_id: string | null;
          justification_id: string | null;
          feedback_id: string | null;
          bucket: string;
          path: string;
          filename: string;
          size_bytes: number;
          mime_type: string;
          created_by: string;
          created_at: string;
          archived: boolean;
        };
        Insert: {
          id?: string;
          employee_id?: string | null;
          justification_id?: string | null;
          feedback_id?: string | null;
          bucket: string;
          path: string;
          filename: string;
          size_bytes: number;
          mime_type: string;
          created_by?: string;
          created_at?: string;
          archived?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["attachments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "attachments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attachments_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attachments_feedback_id_fkey";
            columns: ["feedback_id"];
            isOneToOne: false;
            referencedRelation: "feedbacks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attachments_justification_id_fkey";
            columns: ["justification_id"];
            isOneToOne: false;
            referencedRelation: "absence_justifications";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_maintenance: {
        Row: {
          id: string;
          session_id: string;
          opened_by: string;
          opened_at: string;
          reason: string;
          closed_by: string | null;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          opened_by: string;
          opened_at?: string;
          reason: string;
          closed_by?: string | null;
          closed_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["attendance_maintenance"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "attendance_maintenance_closed_by_fkey";
            columns: ["closed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_maintenance_opened_by_fkey";
            columns: ["opened_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_maintenance_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "attendance_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_members: {
        Row: {
          id: string;
          session_id: string;
          employee_id: string;
          full_name_snapshot: string;
          registration_snapshot: string;
          expected_arrival: string;
          expected_departure: string;
          status: string;
          actual_arrival: string | null;
          actual_departure: string | null;
          notes: string;
          delay_minutes: number | null;
          early_minutes: number | null;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          session_id: string;
          employee_id: string;
          full_name_snapshot: string;
          registration_snapshot: string;
          expected_arrival: string;
          expected_departure: string;
          status?: string;
          actual_arrival?: string | null;
          actual_departure?: string | null;
          notes?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["attendance_members"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "attendance_members_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_members_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "attendance_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_sessions: {
        Row: {
          id: string;
          class_id: string;
          scheduled_date: string;
          status: string;
          original_member_count: number;
          opened_by: string;
          opened_at: string;
          finalized_by: string | null;
          finalized_at: string | null;
          finalization_reason: string | null;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          class_id: string;
          scheduled_date: string;
          status?: string;
          original_member_count?: number;
          opened_by: string;
          opened_at?: string;
          finalized_by?: string | null;
          finalized_at?: string | null;
          finalization_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["attendance_sessions"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_sessions_finalized_by_fkey";
            columns: ["finalized_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_sessions_opened_by_fkey";
            columns: ["opened_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          event_type: string;
          severity: string;
          actor_user_id: string | null;
          actor_name: string | null;
          actor_roles: string[] | null;
          action: string;
          module: string;
          entity_id: string | null;
          old_values: Json | null;
          new_values: Json | null;
          context: Json;
          success: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type?: string;
          severity?: string;
          actor_user_id?: string | null;
          actor_name?: string | null;
          actor_roles?: string[] | null;
          action: string;
          module: string;
          entity_id?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          context?: Json;
          success?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
        Relationships: [];
      };
      classes: {
        Row: {
          id: string;
          name: string;
          code: string;
          active: boolean;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<Database["public"]["Tables"]["classes"]["Insert"]>;
        Relationships: [];
      };
      course_calendar: {
        Row: {
          id: string;
          class_id: string | null;
          scheduled_date: string;
          has_course: boolean;
          kind: string;
          reason: string;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          class_id?: string | null;
          scheduled_date: string;
          has_course?: boolean;
          kind: string;
          reason: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["course_calendar"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "course_calendar_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      departments: {
        Row: {
          id: string;
          name: string;
          active: boolean;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          name: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<Database["public"]["Tables"]["departments"]["Insert"]>;
        Relationships: [];
      };
      employee_admin_notes: {
        Row: {
          id: string;
          employee_id: string;
          notes: string;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          employee_id: string;
          notes?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["employee_admin_notes"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "employee_admin_notes_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      employees: {
        Row: {
          id: string;
          profile_id: string | null;
          full_name: string;
          social_name: string | null;
          email: string | null;
          phone: string | null;
          registration: string;
          join_date: string;
          class_id: string | null;
          department_id: string | null;
          job_position_id: string | null;
          manager_id: string | null;
          member_group: string;
          expected_arrival: string;
          expected_departure: string;
          status: string;
          photo_path: string | null;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          full_name: string;
          social_name?: string | null;
          email?: string | null;
          phone?: string | null;
          registration: string;
          join_date?: string;
          class_id?: string | null;
          department_id?: string | null;
          job_position_id?: string | null;
          manager_id?: string | null;
          member_group?: string;
          expected_arrival?: string;
          expected_departure?: string;
          status?: string;
          photo_path?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<Database["public"]["Tables"]["employees"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "employees_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employees_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employees_job_position_id_fkey";
            columns: ["job_position_id"];
            isOneToOne: false;
            referencedRelation: "job_positions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employees_manager_id_fkey";
            columns: ["manager_id"];
            isOneToOne: false;
            referencedRelation: "managers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employees_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          id: string;
          title: string;
          event_date: string;
          class_id: string | null;
          description: string;
          status: string;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          title: string;
          event_date: string;
          class_id?: string | null;
          description?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "events_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      feedback_followups: {
        Row: {
          id: string;
          feedback_id: string;
          author_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          feedback_id: string;
          author_id?: string;
          body: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["feedback_followups"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "feedback_followups_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feedback_followups_feedback_id_fkey";
            columns: ["feedback_id"];
            isOneToOne: false;
            referencedRelation: "feedbacks";
            referencedColumns: ["id"];
          },
        ];
      };
      feedbacks: {
        Row: {
          id: string;
          employee_id: string;
          author_id: string;
          title: string;
          kind: string;
          description: string;
          strengths: string;
          improvements: string;
          actions: string;
          due_date: string | null;
          status: string;
          released: boolean;
          allow_response: boolean;
          read_at: string | null;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          employee_id: string;
          author_id?: string;
          title: string;
          kind: string;
          description: string;
          strengths?: string;
          improvements?: string;
          actions?: string;
          due_date?: string | null;
          status?: string;
          released?: boolean;
          allow_response?: boolean;
          read_at?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<Database["public"]["Tables"]["feedbacks"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "feedbacks_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feedbacks_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      job_positions: {
        Row: {
          id: string;
          name: string;
          description: string;
          active: boolean;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["job_positions"]["Insert"]
        >;
        Relationships: [];
      };
      justification_categories: {
        Row: {
          id: string;
          name: string;
          active: boolean;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          name: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["justification_categories"]["Insert"]
        >;
        Relationships: [];
      };
      manager_cycle_criteria: {
        Row: {
          cycle_id: string;
          criterion_id: string;
          name_snapshot: string;
        };
        Insert: {
          cycle_id: string;
          criterion_id: string;
          name_snapshot: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["manager_cycle_criteria"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "manager_cycle_criteria_criterion_id_fkey";
            columns: ["criterion_id"];
            isOneToOne: false;
            referencedRelation: "manager_review_criteria";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "manager_cycle_criteria_cycle_id_fkey";
            columns: ["cycle_id"];
            isOneToOne: false;
            referencedRelation: "manager_review_cycles";
            referencedColumns: ["id"];
          },
        ];
      };
      manager_cycle_targets: {
        Row: {
          cycle_id: string;
          manager_id: string;
        };
        Insert: {
          cycle_id: string;
          manager_id: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["manager_cycle_targets"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "manager_cycle_targets_cycle_id_fkey";
            columns: ["cycle_id"];
            isOneToOne: false;
            referencedRelation: "manager_review_cycles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "manager_cycle_targets_manager_id_fkey";
            columns: ["manager_id"];
            isOneToOne: false;
            referencedRelation: "managers";
            referencedColumns: ["id"];
          },
        ];
      };
      manager_review_criteria: {
        Row: {
          id: string;
          name: string;
          active: boolean;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          name: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["manager_review_criteria"]["Insert"]
        >;
        Relationships: [];
      };
      manager_review_cycles: {
        Row: {
          id: string;
          title: string;
          description: string;
          start_date: string;
          end_date: string;
          status: string;
          minimum_responses: number;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string;
          start_date: string;
          end_date: string;
          status?: string;
          minimum_responses?: number;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["manager_review_cycles"]["Insert"]
        >;
        Relationships: [];
      };
      managers: {
        Row: {
          id: string;
          full_name: string;
          profile_id: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          full_name: string;
          profile_id?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<Database["public"]["Tables"]["managers"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "managers_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string;
          path: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          body?: string;
          path?: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["notifications"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      performance_criteria: {
        Row: {
          id: string;
          name: string;
          weight: number;
          active: boolean;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          name: string;
          weight?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["performance_criteria"]["Insert"]
        >;
        Relationships: [];
      };
      performance_cycles: {
        Row: {
          id: string;
          title: string;
          start_date: string;
          end_date: string;
          status: string;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          title: string;
          start_date: string;
          end_date: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["performance_cycles"]["Insert"]
        >;
        Relationships: [];
      };
      performance_reviews: {
        Row: {
          id: string;
          employee_id: string;
          cycle_id: string;
          reviewer_id: string;
          notes: string;
          released: boolean;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          employee_id: string;
          cycle_id: string;
          reviewer_id?: string;
          notes?: string;
          released?: boolean;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["performance_reviews"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "performance_reviews_cycle_id_fkey";
            columns: ["cycle_id"];
            isOneToOne: false;
            referencedRelation: "performance_cycles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "performance_reviews_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "performance_reviews_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      performance_scores: {
        Row: {
          id: string;
          review_id: string;
          criterion_id: string;
          criterion_name: string;
          score: number;
          weight: number;
        };
        Insert: {
          id?: string;
          review_id: string;
          criterion_id: string;
          criterion_name: string;
          score: number;
          weight: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["performance_scores"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "performance_scores_criterion_id_fkey";
            columns: ["criterion_id"];
            isOneToOne: false;
            referencedRelation: "performance_criteria";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "performance_scores_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "performance_reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      permissions: {
        Row: {
          id: string;
          code: string;
          name: string;
          module: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          module: string;
        };
        Update: Partial<Database["public"]["Tables"]["permissions"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string | null;
          registration: string | null;
          requested_class: string | null;
          requested_department_id: string | null;
          requested_role_code: string | null;
          status: string;
          onboarded_at: string | null;
          terms_accepted_at: string | null;
          last_seen_at: string | null;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id: string;
          full_name: string;
          email: string;
          phone?: string | null;
          registration?: string | null;
          requested_class?: string | null;
          requested_department_id?: string | null;
          requested_role_code?: string | null;
          status?: string;
          onboarded_at?: string | null;
          terms_accepted_at?: string | null;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "profiles_requested_department_id_fkey";
            columns: ["requested_department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      releases: {
        Row: {
          id: string;
          version: string;
          changes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          version: string;
          changes: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["releases"]["Insert"]>;
        Relationships: [];
      };
      report_exports: {
        Row: {
          id: string;
          report_id: string;
          format: string;
          path: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          format: string;
          path: string;
          created_by?: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["report_exports"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "report_exports_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_exports_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          id: string;
          title: string;
          kind: string;
          period_start: string;
          period_end: string;
          employee_id: string | null;
          class_id: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          kind: string;
          period_start: string;
          period_end: string;
          employee_id?: string | null;
          class_id?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "reports_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      role_permissions: {
        Row: {
          role_id: string;
          permission_id: string;
        };
        Insert: {
          role_id: string;
          permission_id: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["role_permissions"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey";
            columns: ["permission_id"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string;
          level: number;
          scope: string;
          privileged: boolean;
          active: boolean;
          archived: boolean;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string;
          level?: number;
          scope?: string;
          privileged?: boolean;
          active?: boolean;
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<Database["public"]["Tables"]["roles"]["Insert"]>;
        Relationships: [];
      };
      settings: {
        Row: {
          id: string;
          key: string;
          value: Json;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          key: string;
          value: Json;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<Database["public"]["Tables"]["settings"]["Insert"]>;
        Relationships: [];
      };
      ti_support_tickets: {
        Row: {
          id: string;
          user_id: string;
          category: string;
          subject: string;
          description: string;
          page_path: string;
          page_url: string;
          page_title: string;
          technical_context: Json;
          attachment_path: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category: string;
          subject: string;
          description: string;
          page_path?: string;
          page_url?: string;
          page_title?: string;
          technical_context?: Json;
          attachment_path?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["ti_support_tickets"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "ti_support_tickets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_role_history: {
        Row: {
          id: string;
          user_id: string;
          role_id: string | null;
          role_code: string;
          role_name: string;
          action: string;
          changed_by: string | null;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role_id?: string | null;
          role_code: string;
          role_name: string;
          action: string;
          changed_by?: string | null;
          source?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_role_history"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "user_role_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_role_history_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          user_id: string;
          role_id: string;
        };
        Insert: {
          user_id: string;
          role_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      approve_user: {
        Args: {
          user_identifier: string | null;
          employee_identifier: string | null;
          reason: string | null;
        };
        Returns: undefined;
      };
      archive_attachment: {
        Args: { identifier: string | null; reason: string | null };
        Returns: undefined;
      };
      attach_file: { Args: { payload: Json | null }; Returns: string };
      authenticate_event: {
        Args: { action_name: string | null };
        Returns: undefined;
      };
      bootstrap: { Args: Record<string, never>; Returns: Json };
      complete_profile: { Args: { payload: Json | null }; Returns: undefined };
      course_status: {
        Args: { class_identifier: string | null; day: string | null };
        Returns: Json;
      };
      dashboard_snapshot: {
        Args: { period_start: string | null; period_end: string | null };
        Returns: Json;
      };
      end_maintenance: {
        Args: { session_identifier: string | null };
        Returns: undefined;
      };
      expire_security_data: { Args: Record<string, never>; Returns: number };
      feedback_reply: {
        Args: {
          identifier: string | null;
          body: string | null;
          mark_read: boolean | null;
        };
        Returns: undefined;
      };
      finalize_attendance: {
        Args: { session_identifier: string | null; reason: string | null };
        Returns: undefined;
      };
      import_calendar: { Args: { rows: Json | null }; Returns: number };
      import_employees: { Args: { rows: Json | null }; Returns: number };
      issue_otp: {
        Args: {
          user_identifier: string | null;
          session_identifier: string | null;
          hash_value: string | null;
        };
        Returns: Json;
      };
      manage_user: {
        Args: {
          user_identifier: string | null;
          new_status: string | null;
          role_identifiers: string[] | null;
          reason: string | null;
        };
        Returns: undefined;
      };
      manager_results: {
        Args: { cycle_identifier: string | null };
        Returns: Json;
      };
      mark_notification: {
        Args: { identifier: string | null };
        Returns: undefined;
      };
      register_push_subscription: {
        Args: {
          endpoint_value: string;
          p256dh_value: string;
          auth_value: string;
          user_agent_value: string | null;
        };
        Returns: string;
      };
      unregister_push_subscription: {
        Args: { endpoint_value: string };
        Returns: undefined;
      };
      my_review_tasks: { Args: Record<string, never>; Returns: Json };
      my_sessions: { Args: { target_user: string | null }; Returns: Json };
      open_attendance: {
        Args: { class_identifier: string | null };
        Returns: string;
      };
      register_export: {
        Args: {
          report_identifier: string | null;
          format_name: string | null;
          file_path: string | null;
        };
        Returns: string;
      };
      register_report: { Args: { payload: Json | null }; Returns: string };
      report_snapshot: {
        Args: {
          period_start: string | null;
          period_end: string | null;
          employee_identifier: string | null;
          class_identifier: string | null;
        };
        Returns: Json;
      };
      review_justification: {
        Args: {
          identifier: string | null;
          decision: string | null;
          note: string | null;
          expected_version: number | null;
        };
        Returns: undefined;
      };
      revoke_session: {
        Args: { session_identifier: string | null };
        Returns: undefined;
      };
      save_attendance: {
        Args: { session_identifier: string | null; changes: Json | null };
        Returns: Json;
      };
      save_entity: {
        Args: {
          entity: string | null;
          payload: Json | null;
          expected_version: number | null;
        };
        Returns: string;
      };
      save_performance: {
        Args: {
          employee_identifier: string | null;
          cycle_identifier: string | null;
          scores: Json | null;
          notes: string | null;
          released: boolean | null;
          expected_version: number | null;
        };
        Returns: string;
      };
      save_review_cycle: {
        Args: {
          payload: Json | null;
          manager_identifiers: string[] | null;
          expected_version: number | null;
        };
        Returns: string;
      };
      save_role: {
        Args: {
          payload: Json | null;
          permission_identifiers: string[] | null;
          expected_version: number | null;
          reason: string | null;
        };
        Returns: string;
      };
      set_review_cycle_status: {
        Args: {
          identifier: string | null;
          next_status: string | null;
          expected_version: number | null;
        };
        Returns: undefined;
      };
      start_maintenance: {
        Args: { session_identifier: string | null; reason: string | null };
        Returns: string;
      };
      submit_justification: {
        Args: {
          member_identifier: string | null;
          category_identifier: string | null;
          reason: string | null;
        };
        Returns: string;
      };
      submit_manager_review: {
        Args: {
          cycle_identifier: string | null;
          manager_identifier: string | null;
          scores: Json | null;
          strengths: string | null;
          improvements: string | null;
          message: string | null;
        };
        Returns: undefined;
      };
      system_health: { Args: Record<string, never>; Returns: Json };
      verify_otp: {
        Args: {
          user_identifier: string | null;
          session_identifier: string | null;
          hash_value: string | null;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
export type TableName = keyof Database["public"]["Tables"];
export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
