import { createBrowserClient } from "@supabase/ssr";

/** Cliente do navegador. Sessão longa: o refresh token mantém a Alinne logada. */
export function clienteSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
