// #region supabase-client
import { createBrowserClient } from "@supabase/ssr";

// Supabase client for the browser. Sign-up runs here, so Supabase sees the user's own IP address.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
// #endregion
