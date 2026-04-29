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
  return {
    url: readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL", "your Supabase project URL"),
    anonKey: readRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "your Supabase anon public key"),
  };
}
