import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getSupabaseBrowserConfig } from "@/lib/supabase/env";

export function createSupabasePublicClient() {
  const { url, anonKey } = getSupabaseBrowserConfig();

  return createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
