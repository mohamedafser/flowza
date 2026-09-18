/**
 * Supabase Database types for Flowza.
 *
 * Regenerate from a running local or linked project:
 *   npm run db:types
 *
 * Do not hand-edit large sections after generation — prefer migration + regen.
 */

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
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          email: string | null;
          phone: string | null;
          website: string | null;
          description: string | null;
          timezone: string;
          currency: string;
          status: Database["public"]["Enums"]["restaurant_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          email?: string | null;
          phone?: string | null;
          website?: string | null;
          description?: string | null;
          timezone?: string;
          currency?: string;
          status?: Database["public"]["Enums"]["restaurant_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          logo_url?: string | null;
          email?: string | null;
          phone?: string | null;
          website?: string | null;
          description?: string | null;
          timezone?: string;
          currency?: string;
          status?: Database["public"]["Enums"]["restaurant_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      restaurant_members: {
        Row: {
          id: string;
          restaurant_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["member_role"];
          status: Database["public"]["Enums"]["member_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["member_role"];
          status?: Database["public"]["Enums"]["member_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          status?: Database["public"]["Enums"]["member_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_members_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      branches: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          slug: string;
          address_line_1: string | null;
          address_line_2: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          country: string | null;
          phone: string | null;
          email: string | null;
          timezone: string;
          use_restaurant_timezone: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          name: string;
          slug: string;
          address_line_1?: string | null;
          address_line_2?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          country?: string | null;
          phone?: string | null;
          email?: string | null;
          timezone?: string;
          use_restaurant_timezone?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          name?: string;
          slug?: string;
          address_line_1?: string | null;
          address_line_2?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          country?: string | null;
          phone?: string | null;
          email?: string | null;
          timezone?: string;
          use_restaurant_timezone?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "branches_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      table_sections: {
        Row: {
          id: string;
          branch_id: string;
          name: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          name: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          name?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "table_sections_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurant_tables: {
        Row: {
          id: string;
          branch_id: string;
          section_id: string | null;
          table_number: string;
          name: string | null;
          capacity: number;
          status: Database["public"]["Enums"]["table_status"];
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          section_id?: string | null;
          table_number: string;
          name?: string | null;
          capacity?: number;
          status?: Database["public"]["Enums"]["table_status"];
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          section_id?: string | null;
          table_number?: string;
          name?: string | null;
          capacity?: number;
          status?: Database["public"]["Enums"]["table_status"];
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_tables_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "table_sections";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      queues: {
        Row: {
          id: string;
          branch_id: string;
          name: string;
          status: Database["public"]["Enums"]["queue_status"];
          prefix: string;
          current_number: number;
          starting_number: number;
          estimated_service_minutes: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          name: string;
          status?: Database["public"]["Enums"]["queue_status"];
          prefix?: string;
          current_number?: number;
          starting_number?: number;
          estimated_service_minutes?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          name?: string;
          status?: Database["public"]["Enums"]["queue_status"];
          prefix?: string;
          current_number?: number;
          starting_number?: number;
          estimated_service_minutes?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "queues_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      queue_entries: {
        Row: {
          id: string;
          queue_id: string;
          customer_id: string | null;
          table_id: string | null;
          token: string;
          business_date: string;
          party_size: number;
          status: Database["public"]["Enums"]["queue_entry_status"];
          joined_at: string;
          called_at: string | null;
          seated_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          skipped_at: string | null;
          no_show_at: string | null;
          public_access_token: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          queue_id: string;
          customer_id?: string | null;
          table_id?: string | null;
          token: string;
          business_date?: string;
          party_size?: number;
          status?: Database["public"]["Enums"]["queue_entry_status"];
          joined_at?: string;
          called_at?: string | null;
          seated_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          skipped_at?: string | null;
          no_show_at?: string | null;
          public_access_token?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          queue_id?: string;
          customer_id?: string | null;
          table_id?: string | null;
          token?: string;
          business_date?: string;
          party_size?: number;
          status?: Database["public"]["Enums"]["queue_entry_status"];
          joined_at?: string;
          called_at?: string | null;
          seated_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          skipped_at?: string | null;
          no_show_at?: string | null;
          public_access_token?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "queue_entries_queue_id_fkey";
            columns: ["queue_id"];
            isOneToOne: false;
            referencedRelation: "queues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "queue_entries_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "queue_entries_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_tables";
            referencedColumns: ["id"];
          },
        ];
      };
      queue_events: {
        Row: {
          id: string;
          queue_entry_id: string;
          event_type: Database["public"]["Enums"]["queue_event_type"];
          metadata: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          queue_entry_id: string;
          event_type: Database["public"]["Enums"]["queue_event_type"];
          metadata?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          queue_entry_id?: string;
          event_type?: Database["public"]["Enums"]["queue_event_type"];
          metadata?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "queue_events_queue_entry_id_fkey";
            columns: ["queue_entry_id"];
            isOneToOne: false;
            referencedRelation: "queue_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "queue_events_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      displays: {
        Row: {
          id: string;
          branch_id: string;
          queue_id: string;
          name: string;
          display_code: string;
          public_token: string;
          mode: Database["public"]["Enums"]["display_mode"];
          is_active: boolean;
          settings: Json;
          last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          queue_id: string;
          name: string;
          display_code: string;
          public_token?: string;
          mode?: Database["public"]["Enums"]["display_mode"];
          is_active?: boolean;
          settings?: Json;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          queue_id?: string;
          name?: string;
          display_code?: string;
          public_token?: string;
          mode?: Database["public"]["Enums"]["display_mode"];
          is_active?: boolean;
          settings?: Json;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "displays_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "displays_queue_id_fkey";
            columns: ["queue_id"];
            isOneToOne: false;
            referencedRelation: "queues";
            referencedColumns: ["id"];
          },
        ];
      };
      qr_codes: {
        Row: {
          id: string;
          restaurant_id: string;
          branch_id: string;
          queue_id: string;
          name: string;
          type: Database["public"]["Enums"]["qr_code_type"];
          public_token: string;
          is_active: boolean;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          branch_id: string;
          queue_id: string;
          name: string;
          type?: Database["public"]["Enums"]["qr_code_type"];
          public_token: string;
          is_active?: boolean;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          branch_id?: string;
          queue_id?: string;
          name?: string;
          type?: Database["public"]["Enums"]["qr_code_type"];
          public_token?: string;
          is_active?: boolean;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "qr_codes_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qr_codes_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qr_codes_queue_id_fkey";
            columns: ["queue_id"];
            isOneToOne: false;
            referencedRelation: "queues";
            referencedColumns: ["id"];
          },
        ];
      };
      reservations: {
        Row: {
          id: string;
          branch_id: string;
          customer_id: string | null;
          reservation_date: string;
          start_time: string;
          end_time: string | null;
          party_size: number;
          status: Database["public"]["Enums"]["reservation_status"];
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          customer_id?: string | null;
          reservation_date: string;
          start_time: string;
          end_time?: string | null;
          party_size?: number;
          status?: Database["public"]["Enums"]["reservation_status"];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          customer_id?: string | null;
          reservation_date?: string;
          start_time?: string;
          end_time?: string | null;
          party_size?: number;
          status?: Database["public"]["Enums"]["reservation_status"];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reservations_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          restaurant_id: string;
          customer_id: string | null;
          queue_entry_id: string | null;
          channel: Database["public"]["Enums"]["notification_channel"];
          type: string;
          status: Database["public"]["Enums"]["notification_status"];
          recipient: string;
          payload: Json;
          sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          customer_id?: string | null;
          queue_entry_id?: string | null;
          channel: Database["public"]["Enums"]["notification_channel"];
          type: string;
          status?: Database["public"]["Enums"]["notification_status"];
          recipient: string;
          payload?: Json;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          customer_id?: string | null;
          queue_entry_id?: string | null;
          channel?: Database["public"]["Enums"]["notification_channel"];
          type?: string;
          status?: Database["public"]["Enums"]["notification_status"];
          recipient?: string;
          payload?: Json;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_queue_entry_id_fkey";
            columns: ["queue_entry_id"];
            isOneToOne: false;
            referencedRelation: "queue_entries";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          restaurant_id: string;
          plan: string;
          status: Database["public"]["Enums"]["subscription_status"];
          provider: string | null;
          provider_subscription_id: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          plan: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          provider?: string | null;
          provider_subscription_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          plan?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          provider?: string | null;
          provider_subscription_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          restaurant_id: string;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurant_settings: {
        Row: {
          restaurant_id: string;
          queue_enabled: boolean;
          default_queue_name: string;
          token_prefix: string;
          starting_token_number: number;
          default_service_minutes: number;
          max_queue_capacity: number | null;
          allow_walk_ins: boolean;
          allow_self_check_in: boolean;
          allow_manual_entry: boolean;
          show_estimated_wait: boolean;
          show_queue_position: boolean;
          show_party_size: boolean;
          allow_customer_cancel: boolean;
          require_customer_name: boolean;
          require_customer_phone: boolean;
          default_language: string;
          date_format: string;
          time_format: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          restaurant_id: string;
          queue_enabled?: boolean;
          default_queue_name?: string;
          token_prefix?: string;
          starting_token_number?: number;
          default_service_minutes?: number;
          max_queue_capacity?: number | null;
          allow_walk_ins?: boolean;
          allow_self_check_in?: boolean;
          allow_manual_entry?: boolean;
          show_estimated_wait?: boolean;
          show_queue_position?: boolean;
          show_party_size?: boolean;
          allow_customer_cancel?: boolean;
          require_customer_name?: boolean;
          require_customer_phone?: boolean;
          default_language?: string;
          date_format?: string;
          time_format?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          restaurant_id?: string;
          queue_enabled?: boolean;
          default_queue_name?: string;
          token_prefix?: string;
          starting_token_number?: number;
          default_service_minutes?: number;
          max_queue_capacity?: number | null;
          allow_walk_ins?: boolean;
          allow_self_check_in?: boolean;
          allow_manual_entry?: boolean;
          show_estimated_wait?: boolean;
          show_queue_position?: boolean;
          show_party_size?: boolean;
          allow_customer_cancel?: boolean;
          require_customer_name?: boolean;
          require_customer_phone?: boolean;
          default_language?: string;
          date_format?: string;
          time_format?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_settings_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: true;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      operating_hours: {
        Row: {
          id: string;
          restaurant_id: string;
          branch_id: string | null;
          day_of_week: number;
          is_closed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          branch_id?: string | null;
          day_of_week: number;
          is_closed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          branch_id?: string | null;
          day_of_week?: number;
          is_closed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "operating_hours_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "operating_hours_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      operating_periods: {
        Row: {
          id: string;
          operating_hours_id: string;
          open_time: string;
          close_time: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          operating_hours_id: string;
          open_time: string;
          close_time: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          operating_hours_id?: string;
          open_time?: string;
          close_time?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "operating_periods_operating_hours_id_fkey";
            columns: ["operating_hours_id"];
            isOneToOne: false;
            referencedRelation: "operating_hours";
            referencedColumns: ["id"];
          },
        ];
      };
      special_hours: {
        Row: {
          id: string;
          restaurant_id: string;
          branch_id: string | null;
          date: string;
          is_closed: boolean;
          open_time: string | null;
          close_time: string | null;
          reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          branch_id?: string | null;
          date: string;
          is_closed?: boolean;
          open_time?: string | null;
          close_time?: string | null;
          reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          branch_id?: string | null;
          date?: string;
          is_closed?: boolean;
          open_time?: string | null;
          close_time?: string | null;
          reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "special_hours_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "special_hours_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_restaurant_with_owner: {
        Args: {
          p_name: string;
          p_slug: string;
          p_email: string;
          p_phone: string;
          p_website: string | null;
          p_description: string | null;
          p_currency: string;
          p_timezone: string;
        };
        Returns: Database["public"]["Tables"]["restaurants"]["Row"];
      };
      is_restaurant_member: {
        Args: { p_restaurant_id: string };
        Returns: boolean;
      };
      has_restaurant_role: {
        Args: {
          p_restaurant_id: string;
          p_roles: Database["public"]["Enums"]["member_role"][];
        };
        Returns: boolean;
      };
      restaurant_id_for_branch: {
        Args: { p_branch_id: string };
        Returns: string;
      };
      restaurant_id_for_queue: {
        Args: { p_queue_id: string };
        Returns: string;
      };
      restaurant_id_for_queue_entry: {
        Args: { p_queue_entry_id: string };
        Returns: string;
      };
      is_branch_member: {
        Args: { p_branch_id: string };
        Returns: boolean;
      };
      restaurant_id_for_operating_hours: {
        Args: { p_operating_hours_id: string };
        Returns: string;
      };
      can_transition_queue_status: {
        Args: {
          p_from: Database["public"]["Enums"]["queue_entry_status"];
          p_to: Database["public"]["Enums"]["queue_entry_status"];
        };
        Returns: boolean;
      };
      format_queue_token: {
        Args: { p_prefix: string; p_number: number; p_pad?: number };
        Returns: string;
      };
      queue_business_date: {
        Args: { p_timezone: string };
        Returns: string;
      };
      queue_enqueue_customer: {
        Args: {
          p_queue_id: string;
          p_party_size: number;
          p_customer_id?: string | null;
          p_customer_name?: string | null;
          p_customer_phone?: string | null;
          p_customer_email?: string | null;
        };
        Returns: Database["public"]["Tables"]["queue_entries"]["Row"];
      };
      queue_call_next: {
        Args: { p_queue_id: string };
        Returns: Database["public"]["Tables"]["queue_entries"]["Row"];
      };
      queue_transition_entry: {
        Args: {
          p_entry_id: string;
          p_to_status: Database["public"]["Enums"]["queue_entry_status"];
          p_table_id?: string | null;
        };
        Returns: Database["public"]["Tables"]["queue_entries"]["Row"];
      };
      get_public_queue_info: {
        Args: { p_restaurant_slug: string; p_branch_slug: string };
        Returns: Json;
      };
      queue_join_public: {
        Args: {
          p_restaurant_slug: string;
          p_branch_slug: string;
          p_name: string;
          p_phone: string | null;
          p_party_size: number;
        };
        Returns: Json;
      };
      get_public_queue_status: {
        Args: { p_access_token: string };
        Returns: Json;
      };
      cancel_public_queue_entry: {
        Args: { p_access_token: string };
        Returns: Json;
      };
      get_public_display: {
        Args: { p_public_token: string };
        Returns: Json;
      };
      get_public_qr_code: {
        Args: { p_public_token: string };
        Returns: Json;
      };
      generate_display_public_token: {
        Args: Record<string, never>;
        Returns: string;
      };
      generate_qr_public_token: {
        Args: Record<string, never>;
        Returns: string;
      };
      generate_display_code: {
        Args: Record<string, never>;
        Returns: string;
      };
      normalize_display_settings: {
        Args: { p_settings: Json };
        Returns: Json;
      };
    };
    Enums: {
      restaurant_status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
      member_role: "OWNER" | "ADMIN" | "MANAGER" | "STAFF";
      member_status: "ACTIVE" | "INVITED" | "SUSPENDED";
      table_status:
        "AVAILABLE" | "OCCUPIED" | "CLEANING" | "RESERVED" | "BLOCKED";
      queue_status: "ACTIVE" | "PAUSED" | "CLOSED";
      queue_entry_status:
        | "WAITING"
        | "CALLED"
        | "SEATED"
        | "COMPLETED"
        | "SKIPPED"
        | "CANCELLED"
        | "NO_SHOW";
      queue_event_type:
        | "JOINED"
        | "CALLED"
        | "SKIPPED"
        | "CANCELLED"
        | "SEATED"
        | "COMPLETED"
        | "NO_SHOW";
      display_mode: "QUEUE" | "TABLES" | "COMBINED";
      qr_code_type: "QUEUE_JOIN";
      reservation_status:
        | "PENDING"
        | "CONFIRMED"
        | "SEATED"
        | "COMPLETED"
        | "CANCELLED"
        | "NO_SHOW";
      notification_channel: "EMAIL" | "SMS" | "WHATSAPP" | "IN_APP";
      notification_status: "PENDING" | "SENT" | "FAILED";
      subscription_status:
        "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];

/** Core application tables introduced in Phase 2. */
export const DATABASE_TABLES = [
  "profiles",
  "restaurants",
  "restaurant_members",
  "branches",
  "table_sections",
  "restaurant_tables",
  "customers",
  "queues",
  "queue_entries",
  "queue_events",
  "displays",
  "qr_codes",
  "reservations",
  "notifications",
  "subscriptions",
  "audit_logs",
  "restaurant_settings",
  "operating_hours",
  "operating_periods",
  "special_hours",
] as const satisfies ReadonlyArray<keyof Database["public"]["Tables"]>;

export type DatabaseTableName = (typeof DATABASE_TABLES)[number];
