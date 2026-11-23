/**
 * Catálogo do Innosystem no celular: importação, consulta por código de barras e por nome,
 * e o pré-preenchimento do cadastro rápido.
 */
import { deduzirBanho, normalizar } from "@/lib/dominio/deducao";
import { codigoDaEtiquetaInnosystem, type ItemCatalogo } from "@/lib/innosystem/importar";
import type { BancoEsplendida, Modelo } from "./db";
import type { DadosModelo } from "./repositorio";

/** Substitui o catálogo inteiro (a exportação nova é a versão completa) e marca para subir. */
export async function importarCatalogo(db: BancoEsplendida, itens: ItemCatalogo[]) {
  await db.transaction("rw", db.catalogo, db.meta, async () => {
    await db.catalogo.clear();
    await db.catalogo.bulkPut(itens);
    await db.meta.put({ chave: "catalogoPendente", valor: true });
    await db.meta.put({ chave: "catalogoImportadoEm", valor: new Date().toISOString() });
  });
}

/**
 * Leitura do código de barras de uma etiqueta antiga. Tenta o texto exato e, se for a etiqueta
 * própria do Innosystem (2 + código + verificador), também pelo código interno.
 */
export async function buscarPorCodigoBarras(db: BancoEsplendida, lido: string): Promise<ItemCatalogo | null> {
  const t = lido.trim();
  if (!t) return null;
  const exato = await db.catalogo.where("codigoBarras").equals(t).first();
  if (exato) return exato;
  const codigo = codigoDaEtiquetaInnosystem(t);
  return codigo ? ((await db.catalogo.get(codigo)) ?? null) : null;
}

/**
 * Autocompletar: todos os pedaços digitados precisam aparecer no nome (original ou sugerido).
 * "brin glow" acha "BR GLOW ROSE". Os mais recentes vêm primeiro (coleção nova é a mais provável).
 */
export async function buscarPorNome(db: BancoEsplendida, digitado: string, limite = 12): Promise<ItemCatalogo[]> {
  const termos = normalizar(digitado).split(" ").filter(Boolean);
  if (termos.length === 0) return [];
  const palavras = (s: string) => s.split(/[ |]+/);
  const achados = await db.catalogo
    .filter((it) => {
      const ps = palavras(it.nomeBusca);
      return termos.every((t) => ps.some((p) => p.startsWith(t)));
    })
    .toArray();
  achados.sort((a, b) => Number(b.codigoInnosystem) - Number(a.codigoInnosystem));
  return achados.slice(0, limite);
}

/** O que o cadastro rápido já preenche a partir do item do catálogo. Ela só confirma. */
export function preencherDoCatalogo(item: ItemCatalogo): Partial<DadosModelo> {
  return {
    nome: item.nomeSugerido,
    referencia: item.referencia,
    codigoBarrasInnosystem: item.codigoBarras,
    categoria: item.categoria,
    banho: deduzirBanho(item.nome),
    custoCentavos: item.custoCentavos,
    ncm: item.ncm,
  };
}

/**
 * Código "genérico" do Innosystem: uma etiqueta usada para várias peças diferentes
 * (ex.: "Peças diversas faixa 4 – R$ 49,90"). Ler esse código não identifica a peça.
 */
export function ehItemGenerico(item: Pick<ItemCatalogo, "nome" | "grupoOriginal"> | null | undefined): boolean {
  if (!item) return false;
  return /\bpe[cç]as\s+diversas\b/i.test(item.nome) || normalizar(item.grupoOriginal ?? "") === "diversos";
}

export interface ResultadoLeitura {
  /** Modelos já cadastrados que batem com a leitura. */
  modelos: Modelo[];
  /** Item do catálogo do Innosystem, se a leitura for de uma etiqueta antiga. */
  item: ItemCatalogo | null;
  /** Verdadeiro quando a leitura não basta para saber qual é a peça (código genérico ou vários modelos). */
  ambiguo: boolean;
}

/**
 * Tudo o que uma leitura pode ser: QR/código novo ("0123"), etiqueta antiga do Innosystem
 * (código de barras) ou o código interno do Innosystem.
 */
export async function lerCodigo(db: BancoEsplendida, lido: string): Promise<ResultadoLeitura> {
  const t = lido.trim();
  if (!t) return { modelos: [], item: null, ambiguo: false };
  if (/^\d{1,4}$/.test(t) && Number(t) > 0) {
    const porCodigo = await db.modelos.where("codigo").equals(t.padStart(4, "0")).first();
    if (porCodigo) return { modelos: [porCodigo], item: null, ambiguo: false };
  }
  const item = await buscarPorCodigoBarras(db, t);
  const barras = [...new Set([t, item?.codigoBarras].filter((x): x is string => !!x))];
  const modelos = (await db.modelos.where("codigoBarrasInnosystem").anyOf(barras).toArray()).sort((a, b) =>
    a.codigo.localeCompare(b.codigo),
  );
  return { modelos, item, ambiguo: ehItemGenerico(item) || modelos.length > 1 };
}

/** O modelo, quando a leitura identifica uma peça só; null se não achar ou se for ambígua. */
export async function acharModeloPorLeitura(db: BancoEsplendida, lido: string) {
  const r = await lerCodigo(db, lido);
  return !r.ambiguo && r.modelos.length === 1 ? r.modelos[0] : null;
}

/** Busca entre os modelos já cadastrados, por pedaços do nome ou da referência. */
export async function buscarModelosPorNome(db: BancoEsplendida, digitado: string, limite = 8) {
  const termos = normalizar(digitado).split(" ").filter(Boolean);
  if (!termos.length) return [];
  const achados = await db.modelos
    .filter((m) => {
      const ps = normalizar(`${m.nome ?? ""} ${m.referencia ?? ""} ${m.codigo}`).split(" ");
      return termos.every((t) => ps.some((p) => p.startsWith(t)));
    })
    .toArray();
  return achados.slice(0, limite);
}
