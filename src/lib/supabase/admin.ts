import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

function readRequiredEnv(name: string, description: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}. Set it to ${description}.`);
  }

  return value;
}

export function createSupabaseAdminClient() {
  return createClient<Database>(
    readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL", "your Supabase project URL"),
    readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY", "your Supabase service role key"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
