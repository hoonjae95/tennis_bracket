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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
  public: {
    Tables: {
      courts: {
        Row: {
          court_type: Database["public"]["Enums"]["court_type"]
          created_at: string
          id: string
          name: string
          room_id: string
          sort_order: number
        }
        Insert: {
          court_type?: Database["public"]["Enums"]["court_type"]
          created_at?: string
          id?: string
          name: string
          room_id: string
          sort_order?: number
        }
        Update: {
          court_type?: Database["public"]["Enums"]["court_type"]
          created_at?: string
          id?: string
          name?: string
          room_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "courts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      match_players: {
        Row: {
          created_at: string
          id: string
          match_id: string
          room_participant_id: string
          team: number
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          room_participant_id: string
          team: number
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          room_participant_id?: string
          team?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_players_room_participant_id_fkey"
            columns: ["room_participant_id"]
            isOneToOne: false
            referencedRelation: "room_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          court_id: string
          created_at: string
          id: string
          match_type: Database["public"]["Enums"]["match_type"]
          room_id: string
          round_no: number
          start_time: string | null
        }
        Insert: {
          court_id: string
          created_at?: string
          id?: string
          match_type: Database["public"]["Enums"]["match_type"]
          room_id: string
          round_no: number
          start_time?: string | null
        }
        Update: {
          court_id?: string
          created_at?: string
          id?: string
          match_type?: Database["public"]["Enums"]["match_type"]
          room_id?: string
          round_no?: number
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string
          gender: Database["public"]["Enums"]["gender"]
          grade: Database["public"]["Enums"]["grade"] | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gender: Database["public"]["Enums"]["gender"]
          grade?: Database["public"]["Enums"]["grade"] | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gender?: Database["public"]["Enums"]["gender"]
          grade?: Database["public"]["Enums"]["grade"] | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      room_participants: {
        Row: {
          created_at: string
          grade_override: Database["public"]["Enums"]["grade"] | null
          id: string
          member_id: string
          room_id: string
        }
        Insert: {
          created_at?: string
          grade_override?: Database["public"]["Enums"]["grade"] | null
          id?: string
          member_id: string
          room_id: string
        }
        Update: {
          created_at?: string
          grade_override?: Database["public"]["Enums"]["grade"] | null
          id?: string
          member_id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          break_minutes: number
          created_at: string
          end_time: string
          event_date: string
          fairness_mode: Database["public"]["Enums"]["fairness_mode"]
          games_per_set: number
          id: string
          is_closed: boolean
          is_indoor: boolean
          location: string
          match_types: Database["public"]["Enums"]["match_type"][]
          minutes_per_match: number
          start_time: string
          status: Database["public"]["Enums"]["room_status"]
          template: Database["public"]["Enums"]["room_template"]
          title: string
          updated_at: string
          warmup_minutes: number
          wrapup_minutes: number
        }
        Insert: {
          break_minutes?: number
          created_at?: string
          end_time: string
          event_date: string
          fairness_mode?: Database["public"]["Enums"]["fairness_mode"]
          games_per_set?: number
          id?: string
          is_closed?: boolean
          is_indoor?: boolean
          location: string
          match_types?: Database["public"]["Enums"]["match_type"][]
          minutes_per_match?: number
          start_time: string
          status?: Database["public"]["Enums"]["room_status"]
          template?: Database["public"]["Enums"]["room_template"]
          title: string
          updated_at?: string
          warmup_minutes?: number
          wrapup_minutes?: number
        }
        Update: {
          break_minutes?: number
          created_at?: string
          end_time?: string
          event_date?: string
          fairness_mode?: Database["public"]["Enums"]["fairness_mode"]
          games_per_set?: number
          id?: string
          is_closed?: boolean
          is_indoor?: boolean
          location?: string
          match_types?: Database["public"]["Enums"]["match_type"][]
          minutes_per_match?: number
          start_time?: string
          status?: Database["public"]["Enums"]["room_status"]
          template?: Database["public"]["Enums"]["room_template"]
          title?: string
          updated_at?: string
          warmup_minutes?: number
          wrapup_minutes?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      court_type: "artificial_grass" | "hard_court" | "clay_court"
      fairness_mode: "normal" | "tournament"
      gender: "male" | "female"
      grade: "A" | "B" | "C" | "D"
      match_type:
        | "mens_doubles"
        | "womens_doubles"
        | "mixed_doubles"
        | "mixed_any_doubles"
        | "mens_singles"
        | "womens_singles"
      room_status: "draft" | "ready" | "published"
      room_template: "tuesday" | "thursday" | "saturday" | "custom"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      court_type: ["artificial_grass", "hard_court", "clay_court"],
      fairness_mode: ["normal", "tournament"],
      gender: ["male", "female"],
      grade: ["A", "B", "C", "D"],
      match_type: [
        "mens_doubles",
        "womens_doubles",
        "mixed_doubles",
        "mixed_any_doubles",
        "mens_singles",
        "womens_singles",
      ],
      room_status: ["draft", "ready", "published"],
      room_template: ["tuesday", "thursday", "saturday", "custom"],
    },
  },
} as const
