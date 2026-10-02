// Supabase Database types — describes the auth schema.
// Supabase Auth manages the auth schema internally; we only need to type
// the User object that comes back from auth.getUser().

export interface Database {
  auth: {
    Tables: {
      users: {
        Row: {
          id: string;
          aud: string;
          role: string;
          email: string;
          email_confirmed_at: string | null;
          phone: string | null;
          phone_confirmed_at: string | null;
          confirmed_at: string | null;
          last_sign_in_at: string | null;
          raw_app_meta_data: Record<string, unknown>;
          raw_user_meta_data: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
}

// Convenience type for the Supabase Auth User object.
export interface SupabaseUser {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  user_metadata: {
    name?: string;
    full_name?: string;
    avatar_url?: string;
    [key: string]: unknown;
  };
  app_metadata: {
    provider?: string;
    [key: string]: unknown;
  };
}
