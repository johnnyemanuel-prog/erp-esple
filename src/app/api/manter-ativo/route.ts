/**
 * Chamado uma vez por dia pela Vercel Cron (vercel.json) para o projeto grátis
 * do Supabase não pausar por inatividade. Usa só a chave pública: a função no banco
 * apenas atualiza a data de um "batimento".
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return new Response("Não autorizado", { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const resp = await fetch(`${url}/rest/v1/rpc/manter_ativo`, {
    method: "POST",
    headers: { apikey: chave, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!resp.ok) return Response.json({ ok: false, erro: await resp.text() }, { status: 500 });
  return Response.json({ ok: true, em: await resp.json() });
}
