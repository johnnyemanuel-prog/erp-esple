-- Catálogo do Innosystem no formato da exportação real ("Tabela de Preço", CSV com ";").
-- A chave passa a ser o código interno do Innosystem; o custo vem como sugestão para o cadastro.
alter table public.catalogo_innosystem
  add column codigo_innosystem text,
  add column nome_sugerido text,
  add column referencia_normalizada text,
  add column grupo_original text,
  add column custo_centavos integer,
  add column preco_centavos integer,
  add column fornecedora text,
  add column cor text,
  add column ncm text,
  add column incluido_em date;

update public.catalogo_innosystem set codigo_innosystem = id::text where codigo_innosystem is null;
alter table public.catalogo_innosystem alter column codigo_innosystem set not null;
alter table public.catalogo_innosystem
  add constraint catalogo_innosystem_codigo_unico unique (user_id, codigo_innosystem);
create index catalogo_innosystem_ref_idx on public.catalogo_innosystem (user_id, referencia_normalizada);
