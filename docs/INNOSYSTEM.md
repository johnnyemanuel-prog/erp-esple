# Exportação do Innosystem

Formato analisado na exportação "Tabela de Preço" recebida em 20/11/2026 (1.389 itens). O leitor está em `src/lib/innosystem/importar.ts`.

## Arquivo

CSV em UTF-8 com BOM, separado por `;`, linhas CRLF. Valores com vírgula decimal (`747,50`), datas `dd/mm/aa`.

Colunas: `código;barras;nome;quantidade;custo;preço;tamanho;cor;ref;idfornecedor;nomefornecedor;idgrupo;grupo;minimo;dtinc;nrncm`.

- `tamanho` e `nrncm` vêm vazios; `cor` quase sempre vazia.
- `preço` é sempre `custo × 2,5`, sem o arredondamento para ,90.
- `quantidade` é o estoque do Innosystem: **não é importada como estoque** (a contagem física é a verdade). Fica só na linha original (`dados`).

## Código de barras

- **Etiqueta própria (1.250 itens):** 6 dígitos = `2` + código Innosystem com 4 dígitos + dígito verificador EAN. Ex.: código 1389 → `213899`. O app aceita a leitura exata e, se não achar, decodifica o código por esse padrão.
- **EAN-13 (138 itens):** `1230000` + referência da fornecedora + verificador. Casado pela leitura exata.
- Um item tem 14 dígitos (provável erro de digitação); casado pela leitura exata.

## Nome

- Abreviações no começo: `BR` brinco, `CL` colar, `AN` anel, `PL` pulseira, `PG` pingente, `CJ` conjunto.
- O número solto no fim do nome é sempre numeração, nunca parte do nome: o próprio código (852 itens) ou, nos códigos até 506, `507 − código` (uma numeração antiga invertida). O nome sugerido tira esse número.
- O banho praticamente não aparece no nome: a Alinne escolhe na hora.

## Grupo → categoria

`Brincos/BRINCO` → Brinco, `Colares/COLAR` → Colar, `Anéis/ANEL` → Anel, `Pulseiras` → Pulseira, `Pingentes/PINGENTE` → Pingente, `Conjuntos` → Conjunto, `Broches` → Broche. `-nenhum-` (144 itens) usa a dedução pelo nome. `Diversos` ("Peças diversas faixa…") e `Embalagens` ficam sem categoria.

Pingente e Broche foram acrescentados à lista de categorias, como o spec permite.

## Referência e fornecedora

- Referências às vezes com prefixo da fornecedora (`MAS-358382`, `HER-25608`, `VIT-4334`); a versão sem prefixo é guardada para casar com a NF no módulo 2. 395 referências se repetem entre itens.
- A mesma fornecedora aparece com nomes diferentes (`HERRERA`, `HERREIRA IND. E COM. LTDA`, `HERREIRA INDUSTRIA E COMERCIO LTDA`): unificar no módulo 2.

## Custo

O custo do catálogo entra **pré-preenchido** no cadastro rápido, como sugestão para a Alinne confirmar.
