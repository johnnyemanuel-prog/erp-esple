# Esplêndida

App de bolso da Alinne para cadastrar, precificar e vender semijoias. A especificação está em [`docs/SPEC.md`](docs/SPEC.md).

PWA em Next.js (Vercel) + Supabase, com cadastro offline no celular (IndexedDB/Dexie) e fila de sincronização própria.

## Comandos

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # regras de negócio, etiquetas e camada offline
npm run build
```

Copie `.env.example` para `.env.local` e preencha com os dados do projeto Supabase.

## Estrutura

| Pasta | O que tem |
|---|---|
| `src/lib/dominio/` | Regras puras: preço de tabela (custo × 2,5 → próximo ,90), desconto e margem, código do modelo, preço disfarçado, dedução de categoria/banho, pendências, geometria da folha de etiquetas |
| `src/lib/etiquetas/` | Geração do PDF A4 das etiquetas (QR vetorial + código + preço disfarçado) |
| `src/lib/offline/` | Banco local (Dexie), operações de cadastro que gravam e enfileiram, e a sincronização com o Supabase |
| `supabase/migrations/` | Schema do banco, RLS por usuária, view de estoque derivado das movimentações e bucket de fotos |
| `src/app/api/manter-ativo/` | Rota chamada pela Vercel Cron todo dia para o Supabase grátis não pausar |

## Decisões de implementação

- Dinheiro sempre em **centavos** (inteiros).
- Ids **uuid gerados no celular**, então a sincronização é um upsert idempotente: reenviar não duplica.
- Estoque nunca é gravado: é a soma das movimentações (view `estoque`).
- Folha A4349: padrão 7 colunas × 18 linhas de 26 × 15 mm, centralizada. Conferir no primeiro teste de impressão e corrigir com o ajuste fino x/y.
