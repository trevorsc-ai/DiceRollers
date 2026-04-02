export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          is_admin: boolean;
          is_public: boolean;
          recovery_email: string | null;
          oath_accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          is_admin?: boolean;
          is_public?: boolean;
          recovery_email?: string | null;
          oath_accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          is_admin?: boolean;
          is_public?: boolean;
          recovery_email?: string | null;
          oath_accepted_at?: string | null;
          created_at?: string;
        };
      };
      menu_items: {
        Row: {
          id: number;
          die_color: "red" | "white" | "daily_double";
          die_number: number;
          drink_name: string;
          logo_url: string | null;
          is_active: boolean;
          updated_at: string;
        };
        Insert: {
          id?: number;
          die_color: "red" | "white" | "daily_double";
          die_number: number;
          drink_name: string;
          logo_url?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: number;
          die_color?: "red" | "white" | "daily_double";
          die_number?: number;
          drink_name?: string;
          logo_url?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      rolls: {
        Row: {
          id: number;
          user_id: string;
          roll_date: string;
          roll_time: string;
          red_die_number: number;
          white_die_number: number;
          red_drink_name: string;
          white_drink_name: string;
          red_drink_logo: string | null;
          white_drink_logo: string | null;
          is_doubles: boolean;
          is_daily_double: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          roll_date?: string;
          roll_time?: string;
          red_die_number: number;
          white_die_number: number;
          red_drink_name: string;
          white_drink_name: string;
          red_drink_logo?: string | null;
          white_drink_logo?: string | null;
          is_doubles?: boolean;
          is_daily_double?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          roll_date?: string;
          roll_time?: string;
          red_die_number?: number;
          white_die_number?: number;
          red_drink_name?: string;
          white_drink_name?: string;
          red_drink_logo?: string | null;
          white_drink_logo?: string | null;
          is_doubles?: boolean;
          is_daily_double?: boolean;
          created_at?: string;
        };
      };
      roll_likes: {
        Row: {
          id: number;
          roll_id: number;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          roll_id: number;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          roll_id?: number;
          user_id?: string;
          created_at?: string;
        };
      };
      achievements: {
        Row: {
          id: string;
          name: string;
          emoji: string;
          description: string;
          category: string;
          category_name: string;
          category_emoji: string;
          target_count: number | null;
          sort_order: number;
        };
        Insert: {
          id: string;
          name: string;
          emoji: string;
          description: string;
          category: string;
          category_name: string;
          category_emoji: string;
          target_count?: number | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          name?: string;
          emoji?: string;
          description?: string;
          category?: string;
          category_name?: string;
          category_emoji?: string;
          target_count?: number | null;
          sort_order?: number;
        };
      };
      user_achievements: {
        Row: {
          id: number;
          user_id: string;
          achievement_id: string;
          progress: number;
          progress_detail: Record<string, unknown> | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          achievement_id: string;
          progress?: number;
          progress_detail?: Record<string, unknown> | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          achievement_id?: string;
          progress?: number;
          progress_detail?: Record<string, unknown> | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_global_stats: {
        Args: Record<string, never>;
        Returns: {
          total_rolls: number;
          total_doubles: number;
          red_die_freq: Record<string, number>;
          white_die_freq: Record<string, number>;
          top_beers: { drink_name: string; count: number }[];
          top_shots: { drink_name: string; count: number }[];
          day_of_week: { day_num: number; count: number }[];
          leaderboard: { username: string; count: number; flair: string[] }[];
        };
      };
      get_achievement_rarity: {
        Args: Record<string, never>;
        Returns: { achievement_id: string; unlock_count: number; total_users: number }[];
      };
    };
    Enums: Record<string, never>;
  };
};
