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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: string | null
          exam_id: string | null
          id: string
          script_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: string | null
          exam_id?: string | null
          id?: string
          script_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: string | null
          exam_id?: string | null
          id?: string
          script_id?: string | null
        }
        Relationships: []
      }
      exams: {
        Row: {
          code: string
          course: string
          created_at: string
          exam_date: string | null
          id: string
          status: Database["public"]["Enums"]["exam_status"]
          title: string
        }
        Insert: {
          code: string
          course?: string
          created_at?: string
          exam_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["exam_status"]
          title: string
        }
        Update: {
          code?: string
          course?: string
          created_at?: string
          exam_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["exam_status"]
          title?: string
        }
        Relationships: []
      }
      mark_revisions: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_marks: number | null
          old_marks: number | null
          question_id: string
          reason: string
          script_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_marks?: number | null
          old_marks?: number | null
          question_id: string
          reason: string
          script_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_marks?: number | null
          old_marks?: number | null
          question_id?: string
          reason?: string
          script_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mark_revisions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mark_revisions_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      marks: {
        Row: {
          evaluator_marks: number | null
          evaluator_remark: string | null
          id: string
          moderated_marks: number | null
          moderation_reason: string | null
          question_id: string
          remark: string | null
          script_id: string
        }
        Insert: {
          evaluator_marks?: number | null
          evaluator_remark?: string | null
          id?: string
          moderated_marks?: number | null
          moderation_reason?: string | null
          question_id: string
          remark?: string | null
          script_id: string
        }
        Update: {
          evaluator_marks?: number | null
          evaluator_remark?: string | null
          id?: string
          moderated_marks?: number | null
          moderation_reason?: string | null
          question_id?: string
          remark?: string | null
          script_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marks_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          roll_number: string | null
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          roll_number?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          roll_number?: string | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          exam_id: string
          id: string
          label: string
          max_marks: number
          number: number
        }
        Insert: {
          exam_id: string
          id?: string
          label?: string
          max_marks: number
          number: number
        }
        Update: {
          exam_id?: string
          id?: string
          label?: string
          max_marks?: number
          number?: number
        }
        Relationships: [
          {
            foreignKeyName: "questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      script_owners: {
        Row: {
          script_id: string
          student_id: string
        }
        Insert: {
          script_id: string
          student_id: string
        }
        Update: {
          script_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_owners_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: true
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          code: string
          created_at: string
          evaluated_at: string | null
          evaluator_id: string | null
          evaluator_total: number | null
          exam_id: string
          file_path: string | null
          final_total: number | null
          id: string
          moderated_at: string | null
          moderator_id: string | null
          sample_answers: Json | null
          status: Database["public"]["Enums"]["script_status"]
        }
        Insert: {
          code: string
          created_at?: string
          evaluated_at?: string | null
          evaluator_id?: string | null
          evaluator_total?: number | null
          exam_id: string
          file_path?: string | null
          final_total?: number | null
          id?: string
          moderated_at?: string | null
          moderator_id?: string | null
          sample_answers?: Json | null
          status?: Database["public"]["Enums"]["script_status"]
        }
        Update: {
          code?: string
          created_at?: string
          evaluated_at?: string | null
          evaluator_id?: string | null
          evaluator_total?: number | null
          exam_id?: string
          file_path?: string | null
          final_total?: number | null
          id?: string
          moderated_at?: string | null
          moderator_id?: string | null
          sample_answers?: Json | null
          status?: Database["public"]["Enums"]["script_status"]
        }
        Relationships: [
          {
            foreignKeyName: "scripts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_assign: { Args: { _exam_id: string }; Returns: number }
      can_see_script: { Args: { _script_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_users_with_roles: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
          roles: Database["public"]["Enums"]["app_role"][]
          roll_number: string
        }[]
      }
      publish_results: { Args: { _exam_id: string }; Returns: undefined }
      reassign_script: {
        Args: { _evaluator: string; _moderator: string; _script_id: string }
        Returns: undefined
      }
      save_evaluation_draft: {
        Args: { _marks: Json; _remarks: Json; _script_id: string }
        Returns: undefined
      }
      submit_evaluation: {
        Args: { _marks: Json; _remarks?: Json; _script_id: string }
        Returns: number
      }
      submit_moderation: {
        Args: {
          _marks: Json
          _reasons?: Json
          _remark: string
          _script_id: string
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "evaluator" | "moderator" | "student"
      exam_status: "draft" | "evaluating" | "published"
      script_status: "unassigned" | "assigned" | "evaluated" | "moderated"
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
    Enums: {
      app_role: ["admin", "evaluator", "moderator", "student"],
      exam_status: ["draft", "evaluating", "published"],
      script_status: ["unassigned", "assigned", "evaluated", "moderated"],
    },
  },
} as const
