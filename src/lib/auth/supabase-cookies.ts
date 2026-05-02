export function isSupabaseAuthCookieName(name: string) {
  return /^sb-.+-auth-token(?:\.\d+)?$/.test(name);
}

