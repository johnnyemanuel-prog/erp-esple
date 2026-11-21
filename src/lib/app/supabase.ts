"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

/**
 * Cliente único do navegador. A sessão fica guardada no aparelho e é renovada sozinha:
 * a Alinne entra uma vez e continua logada, inclusive sem internet.
 * Fluxo "implicit" para o link de nova senha funcionar mesmo aberto a partir do Gmail.
 */
export function supabase(): SupabaseClient {
  cliente ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } },
  );
  return cliente;
}
