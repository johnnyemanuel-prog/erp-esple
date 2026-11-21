-- A tarefa diária da Vercel chama esta função com a chave pública, sem precisar da chave secreta.
-- Ela só atualiza a data do "batimento": não lê nem expõe dado nenhum.
create or replace function public.manter_ativo() returns timestamptz
language sql security definer set search_path = '' as $$
  update public.batimento set em = now() where id = 1 returning em;
$$;
revoke all on function public.manter_ativo() from public;
grant execute on function public.manter_ativo() to anon, authenticated;
