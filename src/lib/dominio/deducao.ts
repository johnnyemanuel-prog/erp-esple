/**
 * Deduz categoria e banho a partir do nome ("Brinco Glow Rosé", "BR FLORES DE ALEGRIA").
 * A Alinne só confirma; as listas são editáveis, então recebem os itens por parâmetro.
 */

export interface ItemLista {
  nome: string;
  /** Palavras que indicam o item no nome do modelo (sem acento, minúsculas). */
  palavras: string[];
}

/** Lista do spec, completada com Pingente e Broche, que existem no Innosystem. */
export const CATEGORIAS_PADRAO: ItemLista[] = [
  { nome: "Brinco", palavras: ["brinco", "brincos", "argola", "argolas", "ear cuff", "earcuff", "ear hook"] },
  { nome: "Colar", palavras: ["colar", "colares", "corrente", "cordao"] },
  { nome: "Choker", palavras: ["choker", "gargantilha"] },
  { nome: "Pulseira", palavras: ["pulseira", "pulseiras", "bracelete"] },
  { nome: "Anel", palavras: ["anel", "aneis", "falange"] },
  { nome: "Pingente", palavras: ["pingente", "pingentes"] },
  { nome: "Tornozeleira", palavras: ["tornozeleira"] },
  { nome: "Piercing", palavras: ["piercing"] },
  { nome: "Broche", palavras: ["broche", "broches"] },
  { nome: "Conjunto", palavras: ["conjunto", "conjuntos", "kit", "trio"] },
  { nome: "Outros", palavras: [] },
];

export const BANHOS_PADRAO: ItemLista[] = [
  { nome: "Dourado", palavras: ["dourado", "dourada", "ouro", "gold", "18k"] },
  { nome: "Prata/ródio", palavras: ["prata", "rodio", "prateado", "prateada", "silver"] },
  { nome: "Ródio negro", palavras: ["rodio negro", "negro", "black"] },
  { nome: "Rosé", palavras: ["rose", "rose gold", "rosa gold"] },
  { nome: "Outros", palavras: [] },
];

/** Abreviações usadas no começo dos nomes do Innosystem. */
export const ABREVIACOES: Record<string, string> = {
  br: "Brinco",
  cl: "Colar",
  an: "Anel",
  pl: "Pulseira",
  pg: "Pingente",
  cj: "Conjunto",
};

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Troca a abreviação do começo do nome pela palavra inteira: "BR FLORES" → "Brinco FLORES". */
export function expandirAbreviacao(nome: string): string {
  const m = nome.trim().match(/^(\S+)(\s+.*)?$/);
  if (!m) return nome.trim();
  const inteira = ABREVIACOES[normalizar(m[1])];
  return inteira ? inteira + (m[2] ?? "") : nome.trim();
}

/** Posição (em caracteres) da palavra inteira no nome normalizado, ou -1. */
function posicaoPalavra(nomeNormalizado: string, palavra: string): number {
  const i = ` ${nomeNormalizado} `.indexOf(` ${palavra} `);
  return i;
}

/**
 * O item cuja palavra aparece primeiro no nome ("Colar com pingente" → Colar).
 * Empate na mesma posição: vence a palavra mais longa ("ródio negro" ganha de "ródio").
 */
export function deduzir(nome: string, lista: ItemLista[]): string | null {
  const n = normalizar(expandirAbreviacao(nome));
  if (!n) return null;
  let melhor: { nome: string; pos: number; tam: number } | null = null;
  for (const item of lista) {
    for (const p of [normalizar(item.nome), ...item.palavras]) {
      if (!p) continue;
      const pos = posicaoPalavra(n, p);
      if (pos < 0) continue;
      if (!melhor || pos < melhor.pos || (pos === melhor.pos && p.length > melhor.tam)) {
        melhor = { nome: item.nome, pos, tam: p.length };
      }
    }
  }
  return melhor?.nome ?? null;
}

export function deduzirCategoria(nome: string, lista: ItemLista[] = CATEGORIAS_PADRAO) {
  return deduzir(nome, lista);
}

export function deduzirBanho(nome: string, lista: ItemLista[] = BANHOS_PADRAO) {
  return deduzir(nome, lista);
}

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "com", "em", "na", "no", "a", "o"]);
const ROMANO = /^(?=[ivxlc]+$)c{0,3}(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i;

/**
 * "BR FLORES DE ALEGRIA 1387" → "Brinco Flores de Alegria".
 * No Innosystem, o número solto no fim do nome é sempre numeração (o próprio código ou uma
 * numeração antiga), nunca parte do nome: conferido nos 1.389 itens da exportação.
 */
export function nomeSugerido(nomeOriginal: string): string {
  let nome = nomeOriginal.trim().replace(/\s+/g, " ").replace(/(\S)\s+\d+$/, "$1");
  nome = expandirAbreviacao(nome);
  return nome
    .split(" ")
    .map((palavra, i) => {
      if (/\d/.test(palavra) || ROMANO.test(palavra) || palavra.includes("/")) return palavra.toUpperCase();
      const min = palavra.toLowerCase();
      if (i > 0 && MINUSCULAS.has(min)) return min;
      return min.charAt(0).toUpperCase() + min.slice(1);
    })
    .join(" ");
}
