export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ai_distractors: {
        Row: {
          created_at: string
          options: string[]
          question_type: string
          sense_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          options: string[]
          question_type: string
          sense_id: string
        }
        Update: {
          created_at?: string
          options?: string[]
          question_type?: string
          sense_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_distractors_sense_id_fkey"
            columns: ["sense_id"]
            isOneToOne: false
            referencedRelation: "senses"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generation_logs: {
        Row: {
          created_at: string
          id: number
          input: string
          kind: string
          success: boolean
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: never
          input: string
          kind: string
          success: boolean
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: never
          input?: string
          kind?: string
          success?: boolean
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          timezone: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id: string
          timezone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          timezone?: string | null
        }
        Relationships: []
      }
      review_logs: {
        Row: {
          answered_at: string
          box_after: number
          box_before: number
          id: number
          is_correct: boolean
          local_date: string
          question_id: string
          question_type: string
          sense_id: string | null
          user_id: string
          was_due: boolean
          word_id: string | null
        }
        ComputedFields: never
        Insert: {
          answered_at?: string
          box_after: number
          box_before: number
          id?: never
          is_correct: boolean
          local_date: string
          question_id: string
          question_type: string
          sense_id?: string | null
          user_id?: string
          was_due: boolean
          word_id?: string | null
        }
        Update: {
          answered_at?: string
          box_after?: number
          box_before?: number
          id?: never
          is_correct?: boolean
          local_date?: string
          question_id?: string
          question_type?: string
          sense_id?: string | null
          user_id?: string
          was_due?: boolean
          word_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_logs_sense_id_fkey"
            columns: ["sense_id"]
            isOneToOne: false
            referencedRelation: "senses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_logs_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      senses: {
        Row: {
          antonyms: string[]
          def_en: string
          def_zh: string
          examples: string[]
          id: string
          pos: Database["public"]["Enums"]["part_of_speech"]
          position: number
          synonyms: string[]
          word_id: string
        }
        ComputedFields: never
        Insert: {
          antonyms?: string[]
          def_en: string
          def_zh: string
          examples?: string[]
          id?: string
          pos: Database["public"]["Enums"]["part_of_speech"]
          position: number
          synonyms?: string[]
          word_id: string
        }
        Update: {
          antonyms?: string[]
          def_en?: string
          def_zh?: string
          examples?: string[]
          id?: string
          pos?: Database["public"]["Enums"]["part_of_speech"]
          position?: number
          synonyms?: string[]
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "senses_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      words: {
        Row: {
          box: number
          created_at: string
          id: string
          ipa: string | null
          is_important: boolean
          next_due_on: string
          text: string
          text_key: string | null
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          box?: number
          created_at?: string
          id?: string
          ipa?: string | null
          is_important?: boolean
          next_due_on: string
          text: string
          text_key?: never
          updated_at?: string
          user_id?: string
        }
        Update: {
          box?: number
          created_at?: string
          id?: string
          ipa?: string | null
          is_important?: boolean
          next_due_on?: string
          text?: string
          text_key?: never
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_review: {
        Args: {
          p_box_after: number
          p_box_before: number
          p_due_after: string
          p_due_before: string
          p_is_correct: boolean
          p_local_date: string
          p_question_id: string
          p_question_type: string
          p_sense_id: string
          p_was_due: boolean
          p_word_id: string
        }
        Returns: Json
      }
      create_word: {
        Args: { p_ipa: string; p_senses: Json; p_text: string; p_today: string }
        Returns: Json
      }
      get_dashboard_stats: { Args: { p_since: string }; Returns: Json }
      replace_word_content: {
        Args: { p_ipa: string; p_senses: Json; p_word_id: string }
        Returns: undefined
      }
      update_word_content: {
        Args: { p_ipa: string; p_senses: Json; p_word_id: string }
        Returns: undefined
      }
    }
    Enums: {
      part_of_speech:
        | "noun"
        | "verb"
        | "adjective"
        | "adverb"
        | "pronoun"
        | "preposition"
        | "conjunction"
        | "interjection"
        | "determiner"
        | "phrase"
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
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
      part_of_speech: [
        "noun",
        "verb",
        "adjective",
        "adverb",
        "pronoun",
        "preposition",
        "conjunction",
        "interjection",
        "determiner",
        "phrase",
      ],
    },
  },
} as const
