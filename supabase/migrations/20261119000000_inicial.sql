-- Esplêndida: base da primeira fatia (inventário de arranque).
-- Convenções:
--   * ids são uuid gerados no celular (cadastro offline), então o upsert é idempotente;
--   * dinheiro em centavos (integer);
--   * toda tabela tem user_id com RLS "só o dono";
--   * atualizado_em é usado pela sincronização (último que escreveu vence).

-- Atualiza atualizado_em em todo update.
create or replace function public.tocar_atualizado_em() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Listas editáveis
-- ---------------------------------------------------------------------------
create table public.categoria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  palavras text[] not null default '{}',
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (user_id, nome)
);

create table public.banho (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  palavras text[] not null default '{}',
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (user_id, nome)
);

-- ---------------------------------------------------------------------------
-- Cadastros
-- ---------------------------------------------------------------------------
create table public.fornecedora (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  cnpj text,
  formato_nota text check (formato_nota in ('xml', 'pdf', 'foto')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.local (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  responsavel text, -- futuro: revenda / "com quem está"
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (user_id, nome)
);

create table public.sessao_contagem (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  local_id uuid not null references public.local,
  inicio timestamptz not null default now(),
  fim timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.modelo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  codigo text not null check (codigo ~ '^[0-9]{4}$' and codigo <> '0000'),
  nome text,
  referencia text,                  -- referência da fornecedora
  codigo_barras_innosystem text,
  categoria text,
  banho text,
  aros_disponiveis text,            -- texto livre, sem estoque por aro
  custo_centavos integer check (custo_centavos > 0),
  preco_provisorio_centavos integer check (preco_provisorio_centavos > 0),
  preco_impresso_centavos integer,  -- o que está na etiqueta colada (null = nunca impressa ou "----")
  etiqueta_impressa_em timestamptz,
  status text not null default 'rascunho' check (status in ('rascunho', 'completo')),
  ncm text,
  origem text,
  fornecedora_id uuid references public.fornecedora,
  embedding real[],                 -- vetor da foto principal, calculado no celular
  embedding_modelo text,            -- qual modelo de IA gerou o vetor (CLIP/SigLIP...)
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (user_id, codigo)
);
create index modelo_codigo_barras_idx on public.modelo (user_id, codigo_barras_innosystem);
create index modelo_referencia_idx on public.modelo (user_id, referencia);

create table public.foto_modelo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  modelo_id uuid not null references public.modelo on delete cascade,
  caminho text not null,            -- no bucket "fotos": <user_id>/<modelo_id>/<id>.webp
  caminho_miniatura text not null,
  principal boolean not null default false,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index foto_modelo_modelo_idx on public.foto_modelo (modelo_id);

-- ---------------------------------------------------------------------------
-- Movimentações: o saldo é sempre a soma delas
-- ---------------------------------------------------------------------------
create table public.movimentacao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  modelo_id uuid not null references public.modelo,
  local_origem_id uuid references public.local,
  local_destino_id uuid references public.local,
  quantidade integer not null check (quantidade > 0),
  tipo text not null check (tipo in ('entrada', 'transferencia', 'venda', 'ajuste')),
  sessao_id uuid references public.sessao_contagem,
  observacao text,
  data timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (
    (tipo = 'entrada'       and local_origem_id is null     and local_destino_id is not null) or
    (tipo = 'venda'         and local_origem_id is not null and local_destino_id is null) or
    (tipo = 'transferencia' and local_origem_id is not null and local_destino_id is not null
                            and local_origem_id <> local_destino_id) or
    (tipo = 'ajuste'        and (local_origem_id is null) <> (local_destino_id is null))
  )
);
create index movimentacao_modelo_idx on public.movimentacao (modelo_id);
create index movimentacao_sessao_idx on public.movimentacao (sessao_id);

create view public.estoque with (security_invoker = true) as
select user_id, modelo_id, local_id, sum(qtd)::integer as quantidade
from (
  select user_id, modelo_id, local_destino_id as local_id, quantidade as qtd
    from public.movimentacao where local_destino_id is not null
  union all
  select user_id, modelo_id, local_origem_id as local_id, -quantidade as qtd
    from public.movimentacao where local_origem_id is not null
) m
group by user_id, modelo_id, local_id;

-- ---------------------------------------------------------------------------
-- Catálogo do Innosystem (só consulta, não vira estoque)
-- ---------------------------------------------------------------------------
create table public.catalogo_innosystem (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  codigo_barras text,
  nome text,
  referencia text,
  categoria text,
  dados jsonb,                      -- linha original da exportação, para não perder colunas
  importado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index catalogo_innosystem_barras_idx on public.catalogo_innosystem (user_id, codigo_barras);

-- ---------------------------------------------------------------------------
-- Etiquetas e configuração
-- ---------------------------------------------------------------------------
create table public.modelo_folha (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  largura_pagina_mm numeric not null default 210,
  altura_pagina_mm numeric not null default 297,
  largura_etiqueta_mm numeric not null,
  altura_etiqueta_mm numeric not null,
  colunas integer not null check (colunas > 0),
  linhas integer not null check (linhas > 0),
  margem_superior_mm numeric not null default 0,
  margem_esquerda_mm numeric not null default 0,
  espaco_horizontal_mm numeric not null default 0,
  espaco_vertical_mm numeric not null default 0,
  ajuste_x_mm numeric not null default 0,
  ajuste_y_mm numeric not null default 0,
  padrao boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (user_id, nome)
);

create table public.configuracao (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  fator_margem_minima numeric not null default 1.5,
  multiplicador_tabela numeric not null default 2.5,
  atualizado_em timestamptz not null default now()
);

-- Usado pela tarefa diária da Vercel para o projeto grátis não pausar.
create table public.batimento (
  id integer primary key default 1 check (id = 1),
  em timestamptz not null default now()
);
insert into public.batimento (id) values (1);

-- ---------------------------------------------------------------------------
-- Gatilhos de atualizado_em e RLS
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'categoria', 'banho', 'fornecedora', 'local', 'sessao_contagem', 'modelo', 'foto_modelo',
    'movimentacao', 'catalogo_innosystem', 'modelo_folha', 'configuracao'
  ] loop
    execute format(
      'create trigger %1$s_atualizado_em before update on public.%1$I
         for each row execute function public.tocar_atualizado_em()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "dono" on public.%1$I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

alter table public.batimento enable row level security; -- sem policy: só service_role acessa

-- ---------------------------------------------------------------------------
-- Storage: fotos privadas, uma pasta por usuária
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', false)
on conflict (id) do nothing;

create policy "fotos do dono" on storage.objects for all to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);
