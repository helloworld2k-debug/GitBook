import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { getSupabaseBrowserConfig } from "@/lib/supabase/env";

type RegisterInput = {
  callbackUrl: string;
  email: string;
  password: string;
};

export async function registerWithEmailPassword(input: RegisterInput) {
  const { url, anonKey } = getSupabaseBrowserConfig();
  const supabase = createBrowserClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // The register route only needs to trigger the signup flow and email confirmation.
      },
    },
  });

  return supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        source: "register_form",
      },
      emailRedirectTo: input.callbackUrl,
    },
  });
}
