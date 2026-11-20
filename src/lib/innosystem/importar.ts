/**
 * Leitura da exportação "Tabela de Preço" do Innosystem (CSV com ";", UTF-8 com BOM).
 * Vira catálogo de consulta, nunca estoque: a contagem física é a verdade.
 *
 * Colunas: código;barras;nome;quantidade;custo;preço;tamanho;cor;ref;idfornecedor;
 *          nomefornecedor;idgrupo;grupo;minimo;dtinc;nrncm
 */
import { deduzirCategoria, normalizar, nomeSugerido } from "@/lib/dominio/deducao";
import { lerReais } from "@/lib/dominio/preco";

export interface ItemCatalogo {
  /** Código interno do Innosystem (sem zeros à esquerda): chave do catálogo. */
  codigoInnosystem: string;
  codigoBarras: string | null;
  nome: string;
  nomeSugerido: string;
  referencia: string | null;
  referenciaNormalizada: string | null;
  categoria: string | null;
  grupoOriginal: string | null;
  custoCentavos: number | null;
  precoCentavos: number | null;
  fornecedora: string | null;
  cor: string | null;
  ncm: string | null;
  incluidoEm: string | null; // AAAA-MM-DD
  /** Nome sem acento e minúsculo (original + sugerido), para o autocompletar. */
  nomeBusca: string;
  /** Linha original, para não perder colunas. */
  dados: Record<string, string>;
}

export interface ResultadoLeitura {
  itens: ItemCatalogo[];
  avisos: string[];
}

/** CSV simples com aspas opcionais. */
export function lerCsv(texto: string, separador = ";"): string[][] {
  const t = texto.replace(/^﻿/, "");
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === separador) { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      if (linha.some((v) => v !== "")) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((v) => v !== "")) linhas.push(linha);
  return linhas;
}

/** Grupo do Innosystem → categoria do Esplêndida. Grupos sem sentido de categoria ficam null. */
const GRUPOS: Record<string, string | null> = {
  brincos: "Brinco", brinco: "Brinco",
  colares: "Colar", colar: "Colar",
  aneis: "Anel", anel: "Anel",
  pulseiras: "Pulseira", pulseira: "Pulseira",
  pingentes: "Pingente", pingente: "Pingente",
  conjuntos: "Conjunto", conjunto: "Conjunto",
  broches: "Broche", broche: "Broche",
  choker: "Choker", chokers: "Choker",
  tornozeleiras: "Tornozeleira", tornozeleira: "Tornozeleira",
  piercings: "Piercing", piercing: "Piercing",
  nenhum: null, diversos: null, embalagens: null, embalagem: null,
};

export function categoriaDoGrupo(grupo: string): string | null {
  return GRUPOS[normalizar(grupo)] ?? null;
}

/** "MAS-358382", "HER-25608", "25608" → "358382", "25608", "25608". Para casar com NF depois. */
export function normalizarReferencia(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const r = ref.trim().toUpperCase().replace(/^[A-Z]{2,4}[-\s]+/, "").replace(/\s+/g, "");
  return r || null;
}

function lerData(d: string): string | null {
  const m = d.trim().match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${ano}-${m[2]}-${m[1]}`;
}

const vazio = (s: string | undefined) => (s && s.trim() ? s.trim() : null);

export function lerExportacaoInnosystem(texto: string): ResultadoLeitura {
  const linhas = lerCsv(texto);
  const avisos: string[] = [];
  if (linhas.length === 0) return { itens: [], avisos: ["Arquivo vazio."] };

  const cab = linhas[0].map((c) => normalizar(c).replace(/ /g, ""));
  const col = (nome: string) => cab.indexOf(nome);
  const obrigatorias = ["codigo", "barras", "nome"];
  const faltando = obrigatorias.filter((c) => col(c) < 0);
  if (faltando.length) {
    return { itens: [], avisos: [`Não parece a exportação do Innosystem: faltam as colunas ${faltando.join(", ")}.`] };
  }

  const vistos = new Map<string, number>();
  const itens: ItemCatalogo[] = [];
  for (let i = 1; i < linhas.length; i++) {
    const l = linhas[i];
    const v = (nome: string) => (col(nome) >= 0 ? (l[col(nome)] ?? "").trim() : "");
    const dados = Object.fromEntries(linhas[0].map((c, j) => [c.trim(), (l[j] ?? "").trim()]));

    const codigo = v("codigo").replace(/^0+/, "");
    const nome = v("nome");
    if (!codigo || !/^\d+$/.test(codigo)) {
      avisos.push(`Linha ${i + 1}: sem código, ignorada.`);
      continue;
    }
    if (vistos.has(codigo)) {
      avisos.push(`Linha ${i + 1}: código ${codigo} repetido (linha ${vistos.get(codigo)}); fica a última.`);
    }
    vistos.set(codigo, i + 1);

    const grupo = vazio(v("grupo"));
    const custo = lerReais(v("custo"));
    const preco = lerReais(v("preco"));
    itens.push({
      codigoInnosystem: codigo,
      codigoBarras: vazio(v("barras")),
      nome,
      nomeSugerido: nomeSugerido(nome),
      referencia: vazio(v("ref")),
      referenciaNormalizada: normalizarReferencia(v("ref")),
      categoria: (grupo && categoriaDoGrupo(grupo)) || deduzirCategoria(nome),
      grupoOriginal: grupo,
      custoCentavos: custo && custo > 0 ? custo : null,
      precoCentavos: preco && preco > 0 ? preco : null,
      fornecedora: vazio(v("nomefornecedor")),
      cor: vazio(v("cor")),
      ncm: vazio(v("nrncm")),
      incluidoEm: lerData(v("dtinc")),
      nomeBusca: `${normalizar(nome)} | ${normalizar(nomeSugerido(nome))}`,
      dados,
    });
  }

  // Repetido: a última linha vence.
  const porCodigo = new Map(itens.map((it) => [it.codigoInnosystem, it]));
  return { itens: [...porCodigo.values()], avisos };
}

/** Dígito verificador EAN/GTIN (pesos 3 e 1 a partir da direita). */
export function digitoEan(semDigito: string): number {
  let soma = 0;
  for (let i = 0; i < semDigito.length; i++) {
    const d = Number(semDigito[semDigito.length - 1 - i]);
    soma += d * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (soma % 10)) % 10;
}

/**
 * As etiquetas próprias do Innosystem têm 6 dígitos: "2" + código com 4 dígitos + verificador.
 * Devolve o código Innosystem ("1389") ou null se a leitura não seguir esse padrão.
 */
export function codigoDaEtiquetaInnosystem(lido: string): string | null {
  const t = lido.trim();
  if (!/^2\d{5}$/.test(t)) return null;
  if (digitoEan(t.slice(0, 5)) !== Number(t[5])) return null;
  return String(Number(t.slice(1, 5))) || null;
}
