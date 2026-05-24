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
    PostgrestVersion: "14.4"
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
      achievements: {
        Row: {
          category: string
          category_emoji: string
          category_name: string
          description: string
          emoji: string
          hidden: boolean
          id: string
          name: string
          sort_order: number
          target_count: number | null
        }
        Insert: {
          category: string
          category_emoji: string
          category_name: string
          description: string
          emoji: string
          hidden?: boolean
          id: string
          name: string
          sort_order?: number
          target_count?: number | null
        }
        Update: {
          category?: string
          category_emoji?: string
          category_name?: string
          description?: string
          emoji?: string
          hidden?: boolean
          id?: string
          name?: string
          sort_order?: number
          target_count?: number | null
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          die_color: string
          die_number: number
          drink_name: string
          id: number
          is_active: boolean
          logo_url: string | null
          updated_at: string
        }
        Insert: {
          die_color: string
          die_number: number
          drink_name: string
          id?: number
          is_active?: boolean
          logo_url?: string | null
          updated_at?: string
        }
        Update: {
          die_color?: string
          die_number?: number
          drink_name?: string
          id?: number
          is_active?: boolean
          logo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          oath_accepted_at: string | null
          recovery_email: string | null
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          is_admin?: boolean
          oath_accepted_at?: string | null
          recovery_email?: string | null
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          oath_accepted_at?: string | null
          recovery_email?: string | null
          username?: string
        }
        Relationships: []
      }
      punch_card_completions: {
        Row: {
          completion_number: number
          earned_at: string
          earned_on_roll_id: number
          id: number
          rolls_to_complete: number | null
          user_id: string
        }
        Insert: {
          completion_number: number
          earned_at?: string
          earned_on_roll_id: number
          id?: number
          rolls_to_complete?: number | null
          user_id: string
        }
        Update: {
          completion_number?: number
          earned_at?: string
          earned_on_roll_id?: number
          id?: number
          rolls_to_complete?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "punch_card_completions_earned_on_roll_id_fkey"
            columns: ["earned_on_roll_id"]
            isOneToOne: false
            referencedRelation: "rolls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_card_completions_earned_on_roll_id_fkey"
            columns: ["earned_on_roll_id"]
            isOneToOne: false
            referencedRelation: "rolls_with_flags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_card_completions_earned_on_roll_id_fkey"
            columns: ["earned_on_roll_id"]
            isOneToOne: false
            referencedRelation: "rolls_with_twins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_card_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roll_likes: {
        Row: {
          created_at: string
          id: number
          roll_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          roll_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          roll_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roll_likes_roll_id_fkey"
            columns: ["roll_id"]
            isOneToOne: false
            referencedRelation: "rolls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roll_likes_roll_id_fkey"
            columns: ["roll_id"]
            isOneToOne: false
            referencedRelation: "rolls_with_flags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roll_likes_roll_id_fkey"
            columns: ["roll_id"]
            isOneToOne: false
            referencedRelation: "rolls_with_twins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roll_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rolls: {
        Row: {
          created_at: string
          id: number
          is_daily_double: boolean
          is_doubles: boolean
          red_die_number: number
          red_drink_logo: string | null
          red_drink_name: string
          roll_date: string
          roll_time: string
          user_id: string
          white_die_number: number
          white_drink_logo: string | null
          white_drink_name: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_daily_double?: boolean
          is_doubles?: boolean
          red_die_number: number
          red_drink_logo?: string | null
          red_drink_name: string
          roll_date?: string
          roll_time?: string
          user_id: string
          white_die_number: number
          white_drink_logo?: string | null
          white_drink_name: string
        }
        Update: {
          created_at?: string
          id?: number
          is_daily_double?: boolean
          is_doubles?: boolean
          red_die_number?: number
          red_drink_logo?: string | null
          red_drink_name?: string
          roll_date?: string
          roll_time?: string
          user_id?: string
          white_die_number?: number
          white_drink_logo?: string | null
          white_drink_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "rolls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          completed_at: string | null
          created_at: string | null
          cycle_roll_count: number
          cycle_started_at: string | null
          earned_on_roll_id: number | null
          id: number
          progress: number
          progress_detail: Json | null
          times_completed: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          achievement_id: string
          completed_at?: string | null
          created_at?: string | null
          cycle_roll_count?: number
          cycle_started_at?: string | null
          earned_on_roll_id?: number | null
          id?: number
          progress?: number
          progress_detail?: Json | null
          times_completed?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          achievement_id?: string
          completed_at?: string | null
          created_at?: string | null
          cycle_roll_count?: number
          cycle_started_at?: string | null
          earned_on_roll_id?: number | null
          id?: number
          progress?: number
          progress_detail?: Json | null
          times_completed?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_earned_on_roll_id_fkey"
            columns: ["earned_on_roll_id"]
            isOneToOne: false
            referencedRelation: "rolls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_earned_on_roll_id_fkey"
            columns: ["earned_on_roll_id"]
            isOneToOne: false
            referencedRelation: "rolls_with_flags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_earned_on_roll_id_fkey"
            columns: ["earned_on_roll_id"]
            isOneToOne: false
            referencedRelation: "rolls_with_twins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      rolls_with_flags: {
        Row: {
          created_at: string | null
          has_achievement: boolean | null
          has_twin: boolean | null
          id: number | null
          is_daily_double: boolean | null
          is_doubles: boolean | null
          red_die_number: number | null
          red_drink_logo: string | null
          red_drink_name: string | null
          roll_date: string | null
          roll_time: string | null
          twin_partners: string[] | null
          user_id: string | null
          user_roll_number: number | null
          white_die_number: number | null
          white_drink_logo: string | null
          white_drink_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rolls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rolls_with_twins: {
        Row: {
          created_at: string | null
          id: number | null
          is_daily_double: boolean | null
          is_doubles: boolean | null
          red_die_number: number | null
          red_drink_logo: string | null
          red_drink_name: string | null
          roll_date: string | null
          roll_time: string | null
          twin_partners: string[] | null
          user_id: string | null
          white_die_number: number | null
          white_drink_logo: string | null
          white_drink_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number | null
          is_daily_double?: boolean | null
          is_doubles?: boolean | null
          red_die_number?: number | null
          red_drink_logo?: string | null
          red_drink_name?: string | null
          roll_date?: string | null
          roll_time?: string | null
          twin_partners?: never
          user_id?: string | null
          white_die_number?: number | null
          white_drink_logo?: string | null
          white_drink_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number | null
          is_daily_double?: boolean | null
          is_doubles?: boolean | null
          red_die_number?: number | null
          red_drink_logo?: string | null
          red_drink_name?: string | null
          roll_date?: string | null
          roll_time?: string | null
          twin_partners?: never
          user_id?: string | null
          white_die_number?: number | null
          white_drink_logo?: string | null
          white_drink_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rolls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_achievement_rarity: {
        Args: never
        Returns: {
          achievement_id: string
          total_users: number
          unlock_count: number
        }[]
      }
      get_admin_dashboard_stats: { Args: never; Returns: Json }
      get_full_leaderboard: { Args: never; Returns: Json }
      get_global_stats: { Args: never; Returns: Json }
      get_personal_stats: { Args: { target_user_id: string }; Returns: Json }
      get_podium_leaderboard: { Args: never; Returns: Json }
      get_punch_card_club: {
        Args: never
        Returns: {
          best_rolls: number
          completion_number: number
          earned_at: string
          total_completions: number
          total_members: number
          user_id: string
          username: string
        }[]
      }
      get_user_profile_stats: { Args: { p_username: string }; Returns: Json }
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
    Enums: {},
  },
} as const
