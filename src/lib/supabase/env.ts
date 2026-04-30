type SupabaseBrowserConfig = {
  url: string;
  anonKey: string;
};

function readRequiredEnv(name: string, description: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}. Set it to ${description}.`);
  }

  return value;
}

export function getSupabaseBrowserConfig(): SupabaseBrowserConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    url: url || readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL", "your Supabase project URL"),
    anonKey: anonKey || readRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "your Supabase anon public key"),
  };
}
