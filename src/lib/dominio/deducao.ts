/**
 * Deduz categoria e banho a partir do nome da fornecedora ("Brinco Glow Rosé").
 * A Alinne só confirma; as listas são editáveis, então recebem os itens por parâmetro.
 */

export interface ItemLista {
  nome: string;
  /** Palavras que indicam o item no nome do modelo (sem acento, minúsculas). */
  palavras: string[];
}

export const CATEGORIAS_PADRAO: ItemLista[] = [
  // Conjunto primeiro: "Conjunto Brinco e Colar" é conjunto, não brinco.
  { nome: "Conjunto", palavras: ["conjunto", "kit", "trio"] },
  { nome: "Brinco", palavras: ["brinco", "argola", "ear cuff", "earcuff", "ear hook"] },
  { nome: "Choker", palavras: ["choker", "gargantilha"] },
  { nome: "Colar", palavras: ["colar", "corrente", "cordao", "pingente"] },
  { nome: "Pulseira", palavras: ["pulseira", "bracelete"] },
  { nome: "Anel", palavras: ["anel", "aneis", "falange"] },
  { nome: "Tornozeleira", palavras: ["tornozeleira"] },
  { nome: "Piercing", palavras: ["piercing"] },
  { nome: "Outros", palavras: [] },
];

export const BANHOS_PADRAO: ItemLista[] = [
  // Ródio negro vem antes de prata/ródio para "ródio negro" não cair em "ródio".
  { nome: "Ródio negro", palavras: ["rodio negro", "negro", "black"] },
  { nome: "Rosé", palavras: ["rose", "rosa gold", "rose gold"] },
  { nome: "Prata/ródio", palavras: ["prata", "rodio", "prateado", "silver"] },
  { nome: "Dourado", palavras: ["dourado", "dourada", "ouro", "gold", "18k"] },
  { nome: "Outros", palavras: [] },
];

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function contemPalavra(nomeNormalizado: string, palavra: string): boolean {
  return ` ${nomeNormalizado} `.includes(` ${palavra} `);
}

/** Primeiro item da lista cujas palavras aparecem no nome. A ordem da lista dá a prioridade. */
export function deduzir(nome: string, lista: ItemLista[]): string | null {
  const n = normalizar(nome);
  if (!n) return null;
  for (const item of lista) {
    const palavras = [normalizar(item.nome), ...item.palavras];
    if (palavras.some((p) => p && contemPalavra(n, p))) return item.nome;
  }
  return null;
}

export function deduzirCategoria(nome: string, lista: ItemLista[] = CATEGORIAS_PADRAO) {
  return deduzir(nome, lista);
}

export function deduzirBanho(nome: string, lista: ItemLista[] = BANHOS_PADRAO) {
  // "Rose gold" contém "gold"; a ordem da lista já resolve (Rosé antes de Dourado).
  return deduzir(nome, lista);
}
