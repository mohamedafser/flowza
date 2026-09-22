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

      organizations: {
        Row: {
          id: string;
          name: string;
          business_type: Database["public"]["Enums"]["organization_business_type"];
          status: Database["public"]["Enums"]["organization_status"];
          plan_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          business_type?: Database["public"]["Enums"]["organization_business_type"];
          status?: Database["public"]["Enums"]["organization_status"];
          plan_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          business_type?: Database["public"]["Enums"]["organization_business_type"];
          status?: Database["public"]["Enums"]["organization_status"];
          plan_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organizations_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          id: string;
          name: string;
          price: number;
          currency: string;
          billing_cycle: Database["public"]["Enums"]["billing_cycle"];
          features: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          price?: number;
          currency?: string;
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"];
          features?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          price?: number;
          currency?: string;
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"];
          features?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          organization_id: string;
          subscription_id: string | null;
          amount: number;
          currency: string;
          status: string;
          provider_payment_id: string | null;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          subscription_id?: string | null;
          amount: number;
          currency?: string;
          status?: string;
          provider_payment_id?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          subscription_id?: string | null;
          amount?: number;
          currency?: string;
          status?: string;
          provider_payment_id?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_invitations: {
        Row: {
          id: string;
          organization_id: string;
          restaurant_id: string;
          email: string;
          role: Database["public"]["Enums"]["member_role"];
          status: Database["public"]["Enums"]["invitation_status"];
          invited_by: string | null;
          accepted_by: string | null;
          accepted_at: string | null;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          restaurant_id: string;
          email: string;
          role?: Database["public"]["Enums"]["member_role"];
          status?: Database["public"]["Enums"]["invitation_status"];
          invited_by?: string | null;
          accepted_by?: string | null;
          accepted_at?: string | null;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          restaurant_id?: string;
          email?: string;
          role?: Database["public"]["Enums"]["member_role"];
          status?: Database["public"]["Enums"]["invitation_status"];
          invited_by?: string | null;
          accepted_by?: string | null;
          accepted_at?: string | null;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_invitations_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_invitations_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      auth_otps: {
        Row: {
          id: string;
          user_id: string | null;
          email: string;
          purpose: Database["public"]["Enums"]["auth_otp_purpose"];
          otp_hash: string;
          expires_at: string;
          verified_at: string | null;
          attempt_count: number;
          last_sent_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          email: string;
          purpose: Database["public"]["Enums"]["auth_otp_purpose"];
          otp_hash: string;
          expires_at: string;
          verified_at?: string | null;
          attempt_count?: number;
          last_sent_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          email?: string;
          purpose?: Database["public"]["Enums"]["auth_otp_purpose"];
          otp_hash?: string;
          expires_at?: string;
          verified_at?: string | null;
          attempt_count?: number;
          last_sent_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      password_reset_authorizations: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          token_hash: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          token_hash: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string;
          token_hash?: string;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      restaurants: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          email: string | null;
          phone: string | null;
          website: string | null;
          description: string | null;
          timezone: string;
          status: Database["public"]["Enums"]["restaurant_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          email?: string | null;
          phone?: string | null;
          website?: string | null;
          description?: string | null;
          timezone?: string;
          status?: Database["public"]["Enums"]["restaurant_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          slug?: string;
          logo_url?: string | null;
          email?: string | null;
          phone?: string | null;
          website?: string | null;
          description?: string | null;
          timezone?: string;
          status?: Database["public"]["Enums"]["restaurant_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restaurants_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurant_members: {
        Row: {
          id: string;
          restaurant_id: string;
          organization_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["member_role"];
          status: Database["public"]["Enums"]["member_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          organization_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["member_role"];
          status?: Database["public"]["Enums"]["member_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          organization_id?: string;
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
            foreignKeyName: "restaurant_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
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
          organization_id: string;
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
          organization_id?: string;
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
          organization_id?: string;
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
          organization_id: string;
          name: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          organization_id?: string;
          name: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          organization_id?: string;
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
          organization_id: string;
          section_id: string | null;
          table_number: string;
          name: string | null;
          capacity: number;
          status: Database["public"]["Enums"]["table_status"];
          sort_order: number;
          cleaning_started_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          organization_id?: string;
          section_id?: string | null;
          table_number: string;
          name?: string | null;
          capacity?: number;
          status?: Database["public"]["Enums"]["table_status"];
          sort_order?: number;
          cleaning_started_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          organization_id?: string;
          section_id?: string | null;
          table_number?: string;
          name?: string | null;
          capacity?: number;
          status?: Database["public"]["Enums"]["table_status"];
          sort_order?: number;
          cleaning_started_at?: string | null;
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
          organization_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          organization_id?: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          organization_id?: string;
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
          organization_id: string;
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
          organization_id?: string;
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
          organization_id?: string;
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
          organization_id: string;
          customer_id: string | null;
          table_id: string | null;
          reservation_id: string | null;
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
          organization_id?: string;
          customer_id?: string | null;
          table_id?: string | null;
          reservation_id?: string | null;
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
          organization_id?: string;
          customer_id?: string | null;
          table_id?: string | null;
          reservation_id?: string | null;
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
          {
            foreignKeyName: "queue_entries_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: ["id"];
          },
        ];
      };
      queue_events: {
        Row: {
          id: string;
          queue_entry_id: string;
          organization_id: string;
          event_type: Database["public"]["Enums"]["queue_event_type"];
          metadata: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          queue_entry_id: string;
          organization_id?: string;
          event_type: Database["public"]["Enums"]["queue_event_type"];
          metadata?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          queue_entry_id?: string;
          organization_id?: string;
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
          organization_id: string;
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
          organization_id?: string;
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
          organization_id?: string;
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
          organization_id: string;
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
          organization_id?: string;
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
          organization_id?: string;
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
          organization_id: string;
          customer_id: string | null;
          reservation_code: string | null;
          reservation_date: string;
          start_time: string;
          end_time: string | null;
          duration_minutes: number;
          party_size: number;
          status: Database["public"]["Enums"]["reservation_status"];
          notes: string | null;
          special_requests: string | null;
          cancelled_reason: string | null;
          table_id: string | null;
          created_by: string | null;
          confirmed_at: string | null;
          arrived_at: string | null;
          seated_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          no_show_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          organization_id?: string;
          customer_id?: string | null;
          reservation_code?: string | null;
          reservation_date: string;
          start_time: string;
          end_time?: string | null;
          duration_minutes?: number;
          party_size?: number;
          status?: Database["public"]["Enums"]["reservation_status"];
          notes?: string | null;
          special_requests?: string | null;
          cancelled_reason?: string | null;
          table_id?: string | null;
          created_by?: string | null;
          confirmed_at?: string | null;
          arrived_at?: string | null;
          seated_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          no_show_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          organization_id?: string;
          customer_id?: string | null;
          reservation_code?: string | null;
          reservation_date?: string;
          start_time?: string;
          end_time?: string | null;
          duration_minutes?: number;
          party_size?: number;
          status?: Database["public"]["Enums"]["reservation_status"];
          notes?: string | null;
          special_requests?: string | null;
          cancelled_reason?: string | null;
          table_id?: string | null;
          created_by?: string | null;
          confirmed_at?: string | null;
          arrived_at?: string | null;
          seated_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          no_show_at?: string | null;
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
          {
            foreignKeyName: "reservations_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_tables";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          restaurant_id: string;
          organization_id: string;
          customer_id: string | null;
          queue_entry_id: string | null;
          reservation_id: string | null;
          branch_id: string | null;
          channel: Database["public"]["Enums"]["notification_channel"];
          type: string;
          status: Database["public"]["Enums"]["notification_status"];
          recipient: string;
          payload: Json;
          audience: string;
          provider: string | null;
          provider_message_id: string | null;
          attempts: number;
          last_attempt_at: string | null;
          error_code: string | null;
          error_message: string | null;
          scheduled_at: string | null;
          idempotency_key: string | null;
          title: string | null;
          body: string | null;
          sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          organization_id?: string;
          customer_id?: string | null;
          queue_entry_id?: string | null;
          reservation_id?: string | null;
          branch_id?: string | null;
          channel: Database["public"]["Enums"]["notification_channel"];
          type: string;
          status?: Database["public"]["Enums"]["notification_status"];
          recipient: string;
          payload?: Json;
          audience?: string;
          provider?: string | null;
          provider_message_id?: string | null;
          attempts?: number;
          last_attempt_at?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          scheduled_at?: string | null;
          idempotency_key?: string | null;
          title?: string | null;
          body?: string | null;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          organization_id?: string;
          customer_id?: string | null;
          queue_entry_id?: string | null;
          reservation_id?: string | null;
          branch_id?: string | null;
          channel?: Database["public"]["Enums"]["notification_channel"];
          type?: string;
          status?: Database["public"]["Enums"]["notification_status"];
          recipient?: string;
          payload?: Json;
          audience?: string;
          provider?: string | null;
          provider_message_id?: string | null;
          attempts?: number;
          last_attempt_at?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          scheduled_at?: string | null;
          idempotency_key?: string | null;
          title?: string | null;
          body?: string | null;
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
          {
            foreignKeyName: "notifications_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_reads: {
        Row: {
          notification_id: string;
          user_id: string;
          read_at: string;
        };
        Insert: {
          notification_id: string;
          user_id: string;
          read_at?: string;
        };
        Update: {
          notification_id?: string;
          user_id?: string;
          read_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_reads_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_notification_preferences: {
        Row: {
          customer_id: string;
          restaurant_id: string;
          organization_id: string;
          email_enabled: boolean;
          whatsapp_enabled: boolean;
          sms_enabled: boolean;
          in_app_enabled: boolean;
          notify_queue_joined: boolean;
          notify_queue_called: boolean;
          notify_queue_reminder: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          customer_id: string;
          restaurant_id: string;
          organization_id?: string;
          email_enabled?: boolean;
          whatsapp_enabled?: boolean;
          sms_enabled?: boolean;
          in_app_enabled?: boolean;
          notify_queue_joined?: boolean;
          notify_queue_called?: boolean;
          notify_queue_reminder?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          customer_id?: string;
          restaurant_id?: string;
          organization_id?: string;
          email_enabled?: boolean;
          whatsapp_enabled?: boolean;
          sms_enabled?: boolean;
          in_app_enabled?: boolean;
          notify_queue_joined?: boolean;
          notify_queue_called?: boolean;
          notify_queue_reminder?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_notification_preferences_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: true;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_notification_preferences_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          id: string;
          restaurant_id: string;
          organization_id: string | null;
          audience: string;
          user_id: string | null;
          customer_id: string | null;
          endpoint: string;
          p256dh: string;
          auth: string;
          expiration_time: string | null;
          user_agent: string | null;
          click_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          organization_id?: string | null;
          audience: string;
          user_id?: string | null;
          customer_id?: string | null;
          endpoint: string;
          p256dh: string;
          auth: string;
          expiration_time?: string | null;
          user_agent?: string | null;
          click_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          organization_id?: string | null;
          audience?: string;
          user_id?: string | null;
          customer_id?: string | null;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          expiration_time?: string | null;
          user_agent?: string | null;
          click_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "push_subscriptions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          restaurant_id: string;
          organization_id: string;
          plan_id: string | null;
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
          organization_id?: string;
          plan_id?: string | null;
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
          organization_id?: string;
          plan_id?: string | null;
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
          organization_id: string;
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
          organization_id?: string;
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
          organization_id?: string;
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
          organization_id: string;
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
          date_format: string;
          time_format: string;
          notifications_email_enabled: boolean;
          notifications_whatsapp_enabled: boolean;
          notifications_sms_enabled: boolean;
          notifications_in_app_enabled: boolean;
          notify_customer_on_join: boolean;
          notify_customer_on_called: boolean;
          notify_customer_on_reminder: boolean;
          notify_staff_on_join: boolean;
          notify_staff_on_cancel: boolean;
          notify_staff_on_no_show: boolean;
          notify_staff_queue_busy_threshold: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          restaurant_id: string;
          organization_id?: string;
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
          date_format?: string;
          time_format?: string;
          notifications_email_enabled?: boolean;
          notifications_whatsapp_enabled?: boolean;
          notifications_sms_enabled?: boolean;
          notifications_in_app_enabled?: boolean;
          notify_customer_on_join?: boolean;
          notify_customer_on_called?: boolean;
          notify_customer_on_reminder?: boolean;
          notify_staff_on_join?: boolean;
          notify_staff_on_cancel?: boolean;
          notify_staff_on_no_show?: boolean;
          notify_staff_queue_busy_threshold?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          restaurant_id?: string;
          organization_id?: string;
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
          date_format?: string;
          time_format?: string;
          notifications_email_enabled?: boolean;
          notifications_whatsapp_enabled?: boolean;
          notifications_sms_enabled?: boolean;
          notifications_in_app_enabled?: boolean;
          notify_customer_on_join?: boolean;
          notify_customer_on_called?: boolean;
          notify_customer_on_reminder?: boolean;
          notify_staff_on_join?: boolean;
          notify_staff_on_cancel?: boolean;
          notify_staff_on_no_show?: boolean;
          notify_staff_queue_busy_threshold?: number | null;
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
          organization_id: string;
          branch_id: string | null;
          day_of_week: number;
          is_closed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          organization_id?: string;
          branch_id?: string | null;
          day_of_week: number;
          is_closed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          organization_id?: string;
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
          organization_id: string;
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
          organization_id?: string;
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
          organization_id?: string;
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
          p_timezone: string;
          p_business_type?: Database["public"]["Enums"]["organization_business_type"];
        };
        Returns: Database["public"]["Tables"]["restaurants"]["Row"];
      };
      is_organization_member: {
        Args: { p_organization_id: string };
        Returns: boolean;
      };
      has_organization_role: {
        Args: {
          p_organization_id: string;
          p_roles: Database["public"]["Enums"]["member_role"][];
        };
        Returns: boolean;
      };
      organization_id_for_restaurant: {
        Args: { p_restaurant_id: string };
        Returns: string;
      };
      current_organization_role: {
        Args: { p_organization_id: string };
        Returns: Database["public"]["Enums"]["member_role"] | null;
      };
      list_organization_members: {
        Args: { p_organization_id: string };
        Returns: {
          id: string;
          user_id: string;
          organization_id: string;
          restaurant_id: string;
          role: Database["public"]["Enums"]["member_role"];
          status: Database["public"]["Enums"]["member_status"];
          full_name: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      invite_organization_member: {
        Args: {
          p_organization_id: string;
          p_email: string;
          p_role: Database["public"]["Enums"]["member_role"];
        };
        Returns: {
          outcome: "ADDED" | "INVITED";
          email: string;
          role: Database["public"]["Enums"]["member_role"];
          restaurant_id: string;
          member_id: string | null;
          invitation_id: string | null;
          expires_at: string | null;
        };
      };
      list_organization_invitations: {
        Args: { p_organization_id: string };
        Returns: {
          id: string;
          organization_id: string;
          restaurant_id: string;
          email: string;
          role: Database["public"]["Enums"]["member_role"];
          status: Database["public"]["Enums"]["invitation_status"];
          invited_by: string | null;
          invited_by_name: string | null;
          expires_at: string;
          created_at: string;
        }[];
      };
      revoke_organization_invitation: {
        Args: { p_invitation_id: string };
        Returns: Database["public"]["Tables"]["organization_invitations"]["Row"];
      };
      update_organization_member_role: {
        Args: {
          p_member_id: string;
          p_role: Database["public"]["Enums"]["member_role"];
        };
        Returns: Database["public"]["Tables"]["restaurant_members"]["Row"];
      };
      remove_organization_member: {
        Args: { p_member_id: string };
        Returns: Database["public"]["Tables"]["restaurant_members"]["Row"];
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
      search_public_queue_customers: {
        Args: {
          p_restaurant_slug: string;
          p_branch_slug: string;
          p_query: string;
        };
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
      notification_enqueue: {
        Args: {
          p_restaurant_id: string;
          p_channel: Database["public"]["Enums"]["notification_channel"];
          p_type: string;
          p_recipient: string;
          p_payload?: Json;
          p_customer_id?: string | null;
          p_queue_entry_id?: string | null;
          p_branch_id?: string | null;
          p_audience?: string;
          p_idempotency_key?: string | null;
          p_title?: string | null;
          p_body?: string | null;
          p_provider?: string | null;
          p_scheduled_at?: string | null;
          p_reservation_id?: string | null;
        };
        Returns: Database["public"]["Tables"]["notifications"]["Row"];
      };
      allocate_reservation_code: {
        Args: { p_restaurant_id: string };
        Returns: string;
      };
      release_expired_cleaning_tables: {
        Args: { p_branch_id?: string | null; p_minutes?: number };
        Returns: number;
      };
      branch_is_open_at: {
        Args: { p_branch_id: string; p_at: string };
        Returns: boolean;
      };
      reservation_table_has_conflict: {
        Args: {
          p_branch_id: string;
          p_table_id: string;
          p_date: string;
          p_start: string;
          p_end: string;
          p_exclude_id?: string | null;
        };
        Returns: boolean;
      };
      reservation_transition: {
        Args: {
          p_reservation_id: string;
          p_to_status: Database["public"]["Enums"]["reservation_status"];
          p_table_id?: string | null;
          p_cancelled_reason?: string | null;
        };
        Returns: Database["public"]["Tables"]["reservations"]["Row"];
      };
      notification_mark_delivery: {
        Args: {
          p_notification_id: string;
          p_status: Database["public"]["Enums"]["notification_status"];
          p_provider?: string | null;
          p_provider_message_id?: string | null;
          p_error_code?: string | null;
          p_error_message?: string | null;
          p_increment_attempt?: boolean;
        };
        Returns: Database["public"]["Tables"]["notifications"]["Row"];
      };
      notification_claim: {
        Args: { p_notification_id: string };
        Returns: Database["public"]["Tables"]["notifications"]["Row"];
      };
    };
    Enums: {
      organization_business_type:
        "RESTAURANT" | "SALON" | "CLINIC" | "CAR_SERVICE" | "OTHER";
      organization_status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
      billing_cycle: "MONTHLY" | "YEARLY";
      restaurant_status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
      member_role: "OWNER" | "ADMIN" | "MANAGER" | "STAFF";
      member_status: "ACTIVE" | "INVITED" | "SUSPENDED";
      invitation_status: "PENDING" | "ACCEPTED" | "REVOKED";
      auth_otp_purpose: "SIGNUP" | "PASSWORD_RESET" | "INVITATION";
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
        | "ARRIVED"
        | "SEATED"
        | "COMPLETED"
        | "CANCELLED"
        | "NO_SHOW";
      notification_channel: "EMAIL" | "SMS" | "WHATSAPP" | "IN_APP" | "PUSH";
      notification_status:
        "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "CANCELLED";
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
  "organizations",
  "plans",
  "payments",
  "restaurants",
  "restaurant_members",
  "organization_invitations",
  "auth_otps",
  "password_reset_authorizations",
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
  "notification_reads",
  "customer_notification_preferences",
  "push_subscriptions",
  "subscriptions",
  "audit_logs",
  "restaurant_settings",
  "operating_hours",
  "operating_periods",
  "special_hours",
] as const satisfies ReadonlyArray<keyof Database["public"]["Tables"]>;

export type DatabaseTableName = (typeof DATABASE_TABLES)[number];
