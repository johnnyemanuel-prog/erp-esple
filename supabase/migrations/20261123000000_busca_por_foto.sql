-- Busca por foto: o vetor de cada foto (calculado no celular) também sobe, para não precisar
-- recalcular depois de reinstalar o app. embedding_modelo diz qual modelo de IA gerou o vetor.
alter table public.foto_modelo
  add column embedding real[],
  add column embedding_modelo text;
