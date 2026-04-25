/**
 * @fileoverview Supabase database type definitions
 * @description TypeScript types generated from Supabase schema
 * @author Ridesk Team
 * @version 1.0.0
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
      // ============================================================================
      // USERS & AUTHENTICATION
      // ============================================================================
      users: {
        Row: {
          id: string;
          role: "SUPER_ADMIN" | "SCHOOL_ADMIN" | "INSTRUCTOR" | "USER";
          school_id: string | null;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone_number: string | null;
          avatar: string | null;
          // Instructor-specific fields
          specialties: string[] | null;
          certifications: string[] | null;
          languages: string[] | null;
          notes: string | null;
          is_primary: boolean | null;
          hourly_rate: number | null;
          commission_rate: number | null;
          // Student-specific fields
          student_level_id: string | null;
          preferred_language: string | null;
          secondary_language: string | null;
          special_needs: string[] | null;
          special_needs_other: string | null;
          arrival_date: string | null;
          departure_date: string | null;
          stay_notes: string | null;
          height: number | null;
          weight: number | null;
          // New student form fields
          whatsapp_number: string | null;
          nationality: string | null;
          can_swim: boolean | null;
          primary_sport: string | null;
          riding_background: string | null;
          preferred_days: string[] | null;
          preferred_time_slots: string[] | null;
          preferred_lesson_types: string[] | null;
          date_of_birth: string | null;
          emergency_contact: string | null;
          emergency_phone: string | null;
          medical_conditions: string | null;
          skill_level: string | null;
          preferred_disciplines: string[] | null;
          consent_physical_condition: boolean;
          consent_terms_conditions: boolean;
          consent_gdpr: boolean;
          consent_photos_videos: boolean | null;
          consent_marketing: boolean | null;
          consent_custom_1: boolean | null;
          consent_custom_2: boolean | null;
          // Common fields
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          role: "SUPER_ADMIN" | "SCHOOL_ADMIN" | "INSTRUCTOR" | "USER";
          school_id?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone_number?: string | null;
          avatar?: string | null;
          // Instructor-specific fields
          specialties?: string[] | null;
          certifications?: string[] | null;
          languages?: string[] | null;
          available?: boolean | null;
          notes?: string | null;
          is_primary?: boolean | null;
          hourly_rate?: number | null;
          commission_rate?: number | null;
          // Student-specific fields
          student_level_id?: string | null;
          preferred_language?: string | null;
          secondary_language?: string | null;
          special_needs?: string[] | null;
          special_needs_other?: string | null;
          arrival_date?: string | null;
          departure_date?: string | null;
          stay_notes?: string | null;
          height?: number | null;
          weight?: number | null;
          // New student form fields
          whatsapp_number?: string | null;
          nationality?: string | null;
          can_swim?: boolean | null;
          primary_sport?: string | null;
          riding_background?: string | null;
          preferred_days?: string[] | null;
          preferred_time_slots?: string[] | null;
          preferred_lesson_types?: string[] | null;
          date_of_birth?: string | null;
          emergency_contact?: string | null;
          emergency_phone?: string | null;
          medical_conditions?: string | null;
          skill_level?: string | null;
          preferred_disciplines?: string[] | null;
          consent_physical_condition?: boolean;
          consent_terms_conditions?: boolean;
          consent_gdpr?: boolean;
          consent_photos_videos?: boolean | null;
          consent_marketing?: boolean | null;
          consent_custom_1?: boolean | null;
          consent_custom_2?: boolean | null;
          // Common fields
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: "SUPER_ADMIN" | "SCHOOL_ADMIN" | "INSTRUCTOR" | "USER";
          school_id?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone_number?: string | null;
          avatar?: string | null;
          // Instructor-specific fields
          specialties?: string[] | null;
          certifications?: string[] | null;
          languages?: string[] | null;
          available?: boolean | null;
          notes?: string | null;
          is_primary?: boolean | null;
          hourly_rate?: number | null;
          commission_rate?: number | null;
          // Student-specific fields
          student_level_id?: string | null;
          preferred_language?: string | null;
          secondary_language?: string | null;
          special_needs?: string[] | null;
          special_needs_other?: string | null;
          arrival_date?: string | null;
          departure_date?: string | null;
          stay_notes?: string | null;
          height?: number | null;
          weight?: number | null;
          // New student form fields
          whatsapp_number?: string | null;
          nationality?: string | null;
          can_swim?: boolean | null;
          primary_sport?: string | null;
          riding_background?: string | null;
          preferred_days?: string[] | null;
          preferred_time_slots?: string[] | null;
          preferred_lesson_types?: string[] | null;
          date_of_birth?: string | null;
          emergency_contact?: string | null;
          emergency_phone?: string | null;
          medical_conditions?: string | null;
          skill_level?: string | null;
          preferred_disciplines?: string[] | null;
          consent_physical_condition?: boolean;
          consent_terms_conditions?: boolean;
          consent_gdpr?: boolean;
          consent_photos_videos?: boolean | null;
          consent_marketing?: boolean | null;
          consent_custom_1?: boolean | null;
          consent_custom_2?: boolean | null;
          // Common fields
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };

      // ============================================================================
      // SCHOOLS
      // ============================================================================
      schools: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          spot_name: string | null;
          windguru_url: string | null;
          disciplines: string[];
          open_hours_start: string | null;
          open_hours_end: string | null;
          default_lesson_status_id: string | null;
          default_payment_status_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          spot_name?: string | null;
          windguru_url?: string | null;
          disciplines: string[];
          open_hours_start?: string | null;
          open_hours_end?: string | null;
          default_lesson_status_id?: string | null;
          default_payment_status_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          logo?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          spot_name?: string | null;
          windguru_url?: string | null;
          disciplines?: string[];
          open_hours_start?: string | null;
          open_hours_end?: string | null;
          default_lesson_status_id?: string | null;
          default_payment_status_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ============================================================================
      // LESSONS
      // ============================================================================
      lessons: {
        Row: {
          id: string;
          school_id: string;
          instructor_id: string;
          booking_id: string | null;
          product_id: string | null;
          discipline: string;
          date: string;
          time: string;
          duration: number;
          level: string;
          lesson_status_id: string | null;
          payment_status_id: string | null;
          notes: string | null;
          price: number | null;
          source: "manual" | "web";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          instructor_id: string;
          booking_id?: string | null;
          product_id?: string | null;
          discipline: string;
          date: string;
          time: string;
          duration: number;
          level: string;
          lesson_status_id?: string | null;
          payment_status_id?: string | null;
          notes?: string | null;
          price?: number | null;
          source?: "manual" | "web";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          instructor_id?: string;
          booking_id?: string | null;
          product_id?: string | null;
          discipline?: string;
          date?: string;
          time?: string;
          duration?: number;
          level?: string;
          lesson_status_id?: string | null;
          payment_status_id?: string | null;
          notes?: string | null;
          price?: number | null;
          source?: "manual" | "web";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lessons_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lessons_instructor_id_fkey";
            columns: ["instructor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };

      // ============================================================================
      // INSTRUCTOR AVAILABILITY
      // ============================================================================
      instructor_availability: {
        Row: {
          id: string;
          instructor_id: string;
          date: string;
          time_start: string;
          time_end: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          instructor_id: string;
          date: string;
          time_start: string;
          time_end: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          instructor_id?: string;
          date?: string;
          time_start?: string;
          time_end?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "instructor_availability_instructor_id_fkey";
            columns: ["instructor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };

      // ============================================================================
      // STUDENT LEVELS
      // ============================================================================
      student_levels: {
        Row: {
          id: string;
          name: string;
          slug: string;
          color: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          color: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          color?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ============================================================================
      // INSTRUCTOR SCHOOLS (Many-to-Many Relationship)
      // ============================================================================
      instructor_schools: {
        Row: {
          id: string;
          instructor_id: string;
          school_id: string;
          is_primary: boolean;
          hourly_rate: number | null;
          commission_rate: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          instructor_id: string;
          school_id: string;
          is_primary?: boolean;
          hourly_rate?: number | null;
          commission_rate?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          instructor_id?: string;
          school_id?: string;
          is_primary?: boolean;
          hourly_rate?: number | null;
          commission_rate?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "instructor_schools_instructor_id_fkey";
            columns: ["instructor_id"];
            isOneToOne: false;
            referencedRelation: "instructors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "instructor_schools_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };

      instructor_lesson_permissions: {
        Row: {
          id: string;
          instructor_id: string;
          school_id: string;
          can_edit_lessons: boolean;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          instructor_id: string;
          school_id: string;
          can_edit_lessons?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          instructor_id?: string;
          school_id?: string;
          can_edit_lessons?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "instructor_lesson_permissions_instructor_id_fkey";
            columns: ["instructor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "instructor_lesson_permissions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };

      // ============================================================================
      // LESSON PARTICIPANTS
      // ============================================================================
      lesson_participants: {
        Row: {
          id: string;
          lesson_id: string;
          student_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          student_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lesson_id?: string;
          student_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_participants_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_participants_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };

      // ============================================================================
      // USER INVITATIONS
      // ============================================================================
      user_invitations: {
        Row: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          role: "INSTRUCTOR" | "USER";
          school_id: string;
          invited_by: string;
          invited_by_name: string;
          invitation_token: string;
          expires_at: string;
          is_used: boolean;
          user_id: string | null;
          form_submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          first_name: string;
          last_name: string;
          role: "INSTRUCTOR" | "USER";
          school_id: string;
          invited_by: string;
          invited_by_name: string;
          invitation_token: string;
          expires_at: string;
          is_used?: boolean;
          user_id?: string | null;
          form_submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string;
          last_name?: string;
          role?: "INSTRUCTOR" | "USER";
          school_id?: string;
          invited_by?: string;
          invited_by_name?: string;
          invitation_token?: string;
          expires_at?: string;
          is_used?: boolean;
          user_id?: string | null;
          form_submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_invitations_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_invitations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };

      // ============================================================================
      // PASSWORD RESET OTPS
      // ============================================================================
      password_reset_otps: {
        Row: {
          id: string;
          email: string;
          otp: string;
          expires_at: string;
          is_used: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          otp: string;
          expires_at: string;
          is_used?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          otp?: string;
          expires_at?: string;
          is_used?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<
  PublicTableNameOrOptions extends
  | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
  | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
  ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
    Database[PublicTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
    Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
  ? R
  : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
    Database["public"]["Views"])
  ? (Database["public"]["Tables"] &
    Database["public"]["Views"])[PublicTableNameOrOptions] extends {
      Row: infer R;
    }
  ? R
  : never
  : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
  | keyof Database["public"]["Tables"]
  | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
  ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I;
  }
  ? I
  : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
  ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
    Insert: infer I;
  }
  ? I
  : never
  : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
  | keyof Database["public"]["Tables"]
  | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
  ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U;
  }
  ? U
  : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
  ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
    Update: infer U;
  }
  ? U
  : never
  : never;
