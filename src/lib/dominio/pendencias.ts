/** O que falta em cada rascunho de modelo. */

export type Pendencia = "nome" | "preco" | "custo" | "foto" | "foto_extra" | "referencia";

export const ROTULO_PENDENCIA: Record<Pendencia, string> = {
  nome: "Nome",
  preco: "Custo ou preço",
  custo: "Custo (preço provisório)",
  foto: "Foto",
  foto_extra: "Foto extra",
  referencia: "Referência da fornecedora",
};

/** Pendências que impedem o modelo de ficar "completo". Foto extra não bloqueia. */
export const PENDENCIAS_BLOQUEANTES: Pendencia[] = ["nome", "preco", "custo", "foto", "referencia"];

export interface DadosPendencia {
  nome?: string | null;
  referencia?: string | null;
  custoCentavos?: number | null;
  precoProvisorioCentavos?: number | null;
  qtdFotos: number;
}

export function pendencias(m: DadosPendencia): Pendencia[] {
  const p: Pendencia[] = [];
  if (!m.nome?.trim()) p.push("nome");
  const temCusto = !!m.custoCentavos && m.custoCentavos > 0;
  const temProvisorio = !!m.precoProvisorioCentavos && m.precoProvisorioCentavos > 0;
  if (!temCusto && !temProvisorio) p.push("preco");
  else if (!temCusto) p.push("custo");
  if (m.qtdFotos < 1) p.push("foto");
  else if (m.qtdFotos < 2) p.push("foto_extra");
  if (!m.referencia?.trim()) p.push("referencia");
  return p;
}

export function statusModelo(m: DadosPendencia): "rascunho" | "completo" {
  return pendencias(m).some((p) => PENDENCIAS_BLOQUEANTES.includes(p)) ? "rascunho" : "completo";
}
