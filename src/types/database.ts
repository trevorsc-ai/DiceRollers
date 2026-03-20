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
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          is_admin?: boolean;
          is_public?: boolean;
          recovery_email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          is_admin?: boolean;
          is_public?: boolean;
          recovery_email?: string | null;
          created_at?: string;
        };
      };
      menu_items: {
        Row: {
          id: number;
          die_color: "red" | "white";
          die_number: number;
          drink_name: string;
          logo_url: string | null;
          is_active: boolean;
          updated_at: string;
        };
        Insert: {
          id?: number;
          die_color: "red" | "white";
          die_number: number;
          drink_name: string;
          logo_url?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: number;
          die_color?: "red" | "white";
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
