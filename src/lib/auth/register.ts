import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RegisterInput = {
  callbackUrl: string;
  email: string;
  password: string;
};

export async function registerWithEmailPassword(input: RegisterInput) {
  const supabase = createSupabaseAdminClient();

  return supabase.auth.admin.createUser({
    email: input.email,
    email_confirm: false,
    password: input.password,
    user_metadata: {
      email_redirect_to: input.callbackUrl,
    },
  });
}
