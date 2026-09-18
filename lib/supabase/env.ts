/**
 * Supabase public client credentials.
 * Prefer NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (new); fall back to ANON_KEY (legacy).
 */
export function getSupabasePublishableKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    undefined
  );
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && getSupabasePublishableKey(),
  );
}

export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = getSupabasePublishableKey();

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    );
  }

  return { url, anonKey };
}
