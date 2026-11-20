# Esplêndida: especificação

App de bolso para a Alinne cadastrar, precificar e vender semijoias. Revisado em 12/11/2026, depois de uma rodada de perguntas (grilling) que fechou as decisões abaixo.

## Visão e premissas

O Esplêndida é uma ferramenta de bolso para visita, banquinha e casa, não um ERP de escritório.

- **Usuária:** só a Alinne, num Samsung Galaxy S25 (Android). Sem multiusuário por enquanto.
- **Contexto de uso:** casas de clientes, escolas, UBS e banquinhas, com internet instável e pouco tempo para digitar.
- **Venda:** presencial. Não há consignado formal. As poucas peças que estão com a mãe dela voltam para casa e são contadas lá.
- **Fiscal:** hoje não há nota fiscal de venda. A Alinne tem CNPJ, que **não é MEI**. O sistema deixa a porta aberta para emitir nota, caso peçam.
- **Ponto de partida:** o Innosystem está incompleto, e ela não sabe ao certo o que tem em estoque. A contagem física é a verdade, e o Innosystem serve só de catálogo de consulta.

**Como saber que deu certo**
- Cadastrar uma peça nova em menos de 30 segundos.
- Registrar uma venda em menos tempo do que no Innosystem.
- Consultar o preço de uma peça etiquetada ou fotografada em poucos segundos, mesmo sem internet.

## Decisões

### Catálogo e estoque

| Tema | Decisão |
|---|---|
| Unidade de controle | Estoque por **modelo** (quantidade), não por unidade nem por lote |
| Volume | ~1.000 peças em ~300 modelos |
| O que é um modelo | Cada nome da fornecedora (ex.: "Brinco Glow Rosé") é um modelo. Cada coleção traz modelos novos, com nomes próprios. **A cor do banho muda o modelo; o tamanho do aro não** |
| Aro de anel | Sem estoque por aro. Há só um campo de texto livre, "aros disponíveis" |
| Categorias | Brinco, colar, choker, pulseira, anel, tornozeleira, piercing, conjunto e outros. A lista é editável e pode ser completada com as categorias do Innosystem |
| Banho | Dourado, prata/ródio, ródio negro, rosé e outros. A lista é editável |
| Locais | Casa e maletas. Cada maleta física é um local. Um campo "com quem está" fica para um módulo futuro de revenda |

### Preço e custo

| Tema | Decisão |
|---|---|
| Preço de tabela | Custo × 2,5, arredondado **sempre para cima até o próximo ,90**. Ex.: 47,50 → 47,90; 47,95 → 48,90 |
| Custo no arranque | Um custo por modelo |
| Custo depois do arranque | Quando entra uma compra, vale o **último custo** |
| Sem custo | Ela pode digitar o preço à mão, e ele fica **provisório** até o custo chegar |
| Desconto | Dado só no orçamento ou na venda, em % ou em R$. A tela mostra a margem que sobrou e **fica vermelha abaixo de custo × 1,5**. A regra é global e configurável. Não há preço mínimo por peça |
| Kit | É uma sugestão de conjunto, e o preço é a **soma das peças**. O desconto é dado no orçamento |

### Etiqueta

| Tema | Decisão |
|---|---|
| Suporte | Adesivo colado num cartãozinho de 15 × 26 mm |
| Folha padrão | **Pimaco A4349**: 15 × 26 mm, 126 por folha A4, jato de tinta ou laser |
| Configuração | Modelos de folha salvos (tamanho, colunas, linhas, margens) e ajuste fino x/y em mm. O conteúdo é fixo, sem editor livre |
| Conteúdo | QR de ~12 mm à esquerda. À direita, em duas linhas: o código do modelo (`0123`) e o preço disfarçado (`7400`) |
| Preço disfarçado | A parte inteira do preço, com zeros à esquerda e **invertida**. R$ 47,90 → `0047` → `7400`. Os centavos são omitidos porque o preço sempre termina em ,90 |
| QR | Contém só o código do modelo, nunca o preço. O app sempre mostra o preço atual |
| Rascunho sem preço | Sai como `0123 ----` |
| Reimpressão | O app guarda o preço impresso de cada modelo e lista "etiquetas a reimprimir" quando o preço atual for diferente |
| Impressão | PDF A4 gerado no **PC** (impressora USB), impresso em 100%. Alternativa: gerar no celular e mandar o PDF para o PC. A impressão começa sempre na 1ª etiqueta da folha |
| Código do modelo | 4 dígitos, sequencial a partir de 0001 e gerado no celular. Toda consulta por código mostra a foto em destaque, para conferir. Não há dígito verificador |

### Tecnologia

| Tema | Decisão |
|---|---|
| App | PWA em Next.js na Vercel: `esplendida.vercel.app` |
| Banco | Projeto novo no Supabase (plano grátis), com uma tarefa diária na Vercel que acessa o banco para ele não pausar |
| Offline | IndexedDB com Dexie no celular e uma fila de sincronização própria. Só o celular cadastra |
| PC | Modo "escritório": lê os dados, imprime etiquetas e exporta a planilha. Não cadastra |
| Login | Supabase Auth com e-mail e senha, uma conta só, sessão longa e RLS (regras de acesso) por usuário |
| IA | **Sem API paga na primeira fatia.** Depois, entra como sugestão em lote (nomes, leitura de NF em PDF ou foto) |
| Busca por foto | O embedding (o vetor que resume a foto) é calculado **no próprio celular**, com CLIP ou SigLIP via transformers.js, também offline. O modelo exato será escolhido testando no S25 com fotos reais |
| Fotos | Comprimidas no celular para ~1024 px (WebP), com miniatura de ~200 px. No arranque basta 1 foto por modelo; fotos extras ficam como pendência |

## Módulos, em ordem

1. **Inventário de arranque**: sessões de contagem, cadastro rápido, pendências, etiquetas (primeira fatia, abaixo).
2. **Importação de NF e custo:** XML da NF-e, com casamento pela referência da fornecedora. Sem XML, PDF ou foto lidos pela IA, com conferência valor por valor. Linhas que não casam vão para confirmação, para não duplicar cadastro.
3. **Estoque por local:** transferências entre locais, alerta de mínimo, relatório do que está parado.
4. **App de campo:** consulta por código ou QR, por foto (3 a 5 candidatas) e por nome. Preço na hora e orçamento vigente com validade, enviado por WhatsApp. O orçamento não reserva estoque.
5. **Venda e recebimento:** Pix, dinheiro e cartão (só registro), parcelas informais, saldo a receber e lembrete de cobrança.
6. **Clientes leves:** nome, WhatsApp, histórico, lista de desejos e CPF/CNPJ opcional.
7. **Kits sugeridos:** adicionados ao orçamento inteiros ou em parte.

Até o módulo 5, as vendas continuam no Innosystem. No Esplêndida, ela só registra a baixa com o botão "vendi 1".

## Primeira fatia: inventário de arranque

### Roteiro físico, por gaveta, caixa ou maleta

1. Abrir uma **sessão de contagem** ("Gaveta 2 do quarto") e escolher o local.
2. Despejar numa bandeja e separar em montinhos por modelo, sem usar o app.
3. Para cada montinho:
   - **ler o código de barras da etiqueta antiga** do Innosystem. O app puxa nome, referência e categoria da exportação. Sem leitura, ela digita parte do nome e escolhe na lista;
   - tirar a foto;
   - informar a quantidade;
   - informar o custo ou o preço (o preço fica provisório), se souber;
   - confirmar e passar ao próximo montinho.
4. **Fechar a sessão**, imprimir as etiquetas da sessão (no PC), colar e guardar.

A categoria e o banho são deduzidos do nome ("Brinco… Rosé") e ela só confirma. Nome em branco vira pendência; a foto basta para identificar.

### Entra na fatia

1. Base no Supabase: modelo, fornecedora, local, sessão de contagem, estoque (derivado das movimentações), movimentação, catálogo do Innosystem e modelo de folha de etiqueta.
2. PWA instalável no Android, com cadastro offline e sincronização depois.
3. **Importação da exportação do Innosystem** como catálogo de consulta (código de barras, nome, referência, categoria). Ela **não** vira estoque.
4. Tela de sessão de contagem e tela de cadastro rápido, com leitura do código de barras antigo e autocompletar por nome.
5. Aviso "parece com 0123, 0456: é o mesmo?" (embedding no celular, offline), com o botão "somar a um modelo existente".
6. Preço de tabela calculado, preço provisório ou "sem preço".
7. Fila de pendências: mostra o que falta em cada rascunho (custo/preço, nome, foto extra, referência) e permite completar em lote.
8. Etiquetas: modelo de folha A4349 configurável, PDF gerado no PC e lista "a reimprimir".
9. Consulta por código ou QR, com botão **"vendi 1"** (só a baixa no estoque).
10. Exportação em planilha (CSV) de modelos e estoque por local.
11. Tarefa diária para manter o Supabase ativo.

### Critério de pronto

- Cadastrar um montinho que tem etiqueta antiga leva menos de 30 segundos.
- Uma gaveta inteira cadastrada sem internet aparece depois no Supabase, sem perda.
- A folha A4349 impressa no PC sai alinhada, com código legível e QR lido pela câmera do S25.
- A fila de pendências mostra corretamente o que falta em cada rascunho.
- O aviso de duplicata aparece ao fotografar de novo um modelo já cadastrado.

## Modelo de dados

O centro é o **modelo** de peça. O saldo de cada modelo em cada local é a soma das movimentações, o que permite auditar qualquer divergência.

| Entidade | Campos principais |
|---|---|
| Modelo | código (4 dígitos), nome, referência da fornecedora, código de barras do Innosystem, categoria, banho, aros disponíveis (texto), fotos, embedding, custo, preço provisório, preço impresso na etiqueta, status (rascunho/completo), NCM e origem (opcionais), fornecedora |
| Fornecedora | nome, CNPJ, formato da nota (XML, PDF ou foto) |
| Local | nome (casa, maleta 1…), responsável (futuro) |
| Sessão de contagem | nome, local, início, fim |
| Movimentação | modelo, local de origem, local de destino, quantidade, tipo (entrada, transferência, venda, ajuste), sessão (opcional), data |
| Catálogo Innosystem | código de barras, nome, referência, categoria (só consulta) |
| Modelo de folha | nome, tamanho da etiqueta, colunas, linhas, margens, ajuste x/y |
| Compra *(módulo 2)* | fornecedora, data, arquivo da NF, itens com quantidade e custo |
| Kit *(módulo 7)* | nome, modelos com quantidade |
| Cliente *(módulo 6)* | nome, WhatsApp, lista de desejos, CPF/CNPJ opcional |
| Orçamento *(módulo 4)* | cliente, itens, desconto, validade, status (aberto, vendido, vencido) |
| Venda *(módulo 5)* | cliente, itens, desconto, total, local, data |
| Pagamento *(módulo 5)* | venda, forma, valor, vencimento, pago |

## Fora do MVP

Os campos que essas funções vão usar já estão previstos no cadastro.

- **Vitrine online e pedidos:** venderia só o que estiver em "casa". Um domínio próprio, se fizer falta, entra nessa hora.
- **NF-e de venda:** usaria NCM e origem do modelo e CPF/CNPJ do cliente, ligados a uma API de emissão.
- **Baixa automática das NFs de compra:** com o certificado digital (e-CNPJ) dela.
- **Pesquisa de preço de mercado por foto:** apoio à decisão, não preço automático.
- **Revenda ou maleta com outra pessoa:** módulo próprio, com acerto de contas.
- **Login para a mãe dela ou outras pessoas.**
- **Controle por unidade ou por lote de compra:** descartado.

## Pendências

Antes de a Alinne começar a contar:
- [x] Exportação do Innosystem (recebida; formato em [`INNOSYSTEM.md`](INNOSYSTEM.md)).
- [ ] Foto de uma etiqueta antiga do Innosystem.
- [ ] Pacote de folhas Pimaco A4349 e teste de impressão no PC.

Para os módulos seguintes:
- [ ] Quais fornecedoras mandam o XML da NF-e (módulo 2).
- [ ] Orientação do contador sobre nota fiscal de venda, já que o CNPJ não é MEI.
