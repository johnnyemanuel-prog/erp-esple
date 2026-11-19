/**
 * Chamado uma vez por dia pela Vercel Cron (vercel.json) para o projeto grátis
 * do Supabase não pausar por inatividade. Grava um "batimento" com a chave de serviço.
 */
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return new Response("Não autorizado", { status: 401 });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.from("batimento").upsert({ id: 1, em: new Date().toISOString() });
  if (error) return Response.json({ ok: false, erro: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
