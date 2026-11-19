/**
 * Regras de preço. Todo valor em dinheiro é guardado em centavos (inteiro),
 * para não sofrer com arredondamento de ponto flutuante.
 */

export const MULTIPLICADOR_TABELA = 2.5;
export const FATOR_MARGEM_MINIMA_PADRAO = 1.5;

/** Arredonda sempre para cima até o próximo ,90. 47,50 → 47,90; 47,95 → 48,90; 47,90 → 47,90. */
export function arredondarPara90(centavos: number): number {
  const c = Math.ceil(centavos);
  const alvo = Math.floor(c / 100) * 100 + 90;
  return alvo >= c ? alvo : alvo + 100;
}

/** Preço de tabela: custo × 2,5, arredondado para cima até o próximo ,90. */
export function precoTabela(custoCentavos: number): number {
  if (!Number.isFinite(custoCentavos) || custoCentavos <= 0) {
    throw new Error("Custo inválido");
  }
  // custo × 2,5 = custo × 5 / 2, exato em inteiros (pode dar meio centavo, que sobe).
  return arredondarPara90((custoCentavos * 5) / 2);
}

export type OrigemPreco = "tabela" | "provisorio" | "sem_preco";

export interface PrecoAtual {
  centavos: number | null;
  origem: OrigemPreco;
}

/** Preço vigente de um modelo: o de tabela se houver custo; senão o provisório; senão nenhum. */
export function precoAtual(modelo: {
  custoCentavos?: number | null;
  precoProvisorioCentavos?: number | null;
}): PrecoAtual {
  if (modelo.custoCentavos && modelo.custoCentavos > 0) {
    return { centavos: precoTabela(modelo.custoCentavos), origem: "tabela" };
  }
  if (modelo.precoProvisorioCentavos && modelo.precoProvisorioCentavos > 0) {
    return { centavos: modelo.precoProvisorioCentavos, origem: "provisorio" };
  }
  return { centavos: null, origem: "sem_preco" };
}

export type Desconto = { tipo: "percentual"; valor: number } | { tipo: "reais"; centavos: number };

export interface ResultadoDesconto {
  precoFinalCentavos: number;
  descontoCentavos: number;
  /** Lucro sobre o custo, em centavos (null sem custo conhecido). */
  margemCentavos: number | null;
  /** Preço final dividido pelo custo (null sem custo conhecido). */
  multiplicador: number | null;
  /** Verdadeiro quando o preço final ficou abaixo de custo × fator mínimo: a tela fica vermelha. */
  abaixoDoMinimo: boolean;
}

export function aplicarDesconto(
  precoCentavos: number,
  desconto: Desconto | null,
  custoCentavos: number | null,
  fatorMinimo: number = FATOR_MARGEM_MINIMA_PADRAO,
): ResultadoDesconto {
  let descontoCentavos = 0;
  if (desconto?.tipo === "percentual") {
    descontoCentavos = Math.round((precoCentavos * desconto.valor) / 100);
  } else if (desconto?.tipo === "reais") {
    descontoCentavos = Math.round(desconto.centavos);
  }
  descontoCentavos = Math.min(Math.max(descontoCentavos, 0), precoCentavos);
  const precoFinalCentavos = precoCentavos - descontoCentavos;

  const temCusto = custoCentavos != null && custoCentavos > 0;
  return {
    precoFinalCentavos,
    descontoCentavos,
    margemCentavos: temCusto ? precoFinalCentavos - custoCentavos : null,
    multiplicador: temCusto ? precoFinalCentavos / custoCentavos : null,
    abaixoDoMinimo: temCusto ? precoFinalCentavos < custoCentavos * fatorMinimo : false,
  };
}

/** "R$ 47,90" */
export function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Lê "47,5", "47.50", "R$ 1.047,90" → centavos. Retorna null se não der para ler. */
export function lerReais(texto: string): number | null {
  let t = texto.replace(/R\$|\s/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
