import { getSupabaseClient } from '@/storage/database/supabase-client';

// Re-export the Supabase client for convenience
export function getClient() {
  return getSupabaseClient();
}
