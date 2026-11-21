# Publicar e instalar

No ar em **https://erp-esple.vercel.app** desde 21/11/2026.

## 1. Vercel (uma vez)

1. Em vercel.com → **Add New → Project**, importe o repositório `johnnyemanuel-prog/erp-esple` (preset **Next.js**). O projeto se chama `erp-esple` e responde em `erp-esple.vercel.app`.
   - Atenção: `esplendida.vercel.app` **não é nosso** (é de outra loja).
2. Em **Environment Variables**, antes de publicar:

   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://kxfkmunpnwfrmekqioha.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | a chave `sb_publishable_…` do projeto (Supabase → Settings → API Keys) |
   | `CRON_SECRET` | um texto aleatório qualquer (só a Vercel usa) |

3. A produção sai da branch `main`. Cada push na `main` publica sozinho.
4. A tarefa diária que mantém o Supabase ativo (`vercel.json`) já vem configurada.

## 2. Supabase (uma vez)

- **Authentication → URL Configuration**
  - Site URL: `https://erp-esple.vercel.app`
  - Redirect URLs: `https://erp-esple.vercel.app/**`
  (sem isso, o link de "esqueci minha senha" aponta para `localhost`)
- **Authentication → Sign In / Providers**: desligar **Allow new users to sign up** (só existe a conta da Alinne).

## 3. No celular da Alinne (Samsung S25)

1. Abrir `erp-esple.vercel.app` no **Chrome** e entrar com o e-mail dela.
2. Menu ⋮ → **Adicionar à tela inicial** → **Instalar**. O ícone da Esplêndida aparece junto dos outros apps.
3. Abrir uma vez com internet e esperar a barra verde "Tudo salvo na nuvem": a partir daí o app abre e cadastra sem internet.
4. Em **Mais → Catálogo do Innosystem**, importar o CSV "Tabela de Preço" (pode ser pelo PC também; o celular baixa do servidor).
5. Na primeira leitura de etiqueta, permitir o uso da câmera.

## 4. No PC

Abrir `erp-esple.vercel.app`, entrar com a mesma conta. O PC entra sozinho no modo **Escritório** (só lê, imprime etiquetas e exporta planilha). Imprimir sempre em **100% / tamanho real**.
