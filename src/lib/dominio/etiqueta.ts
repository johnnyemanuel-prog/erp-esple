/** Regras do conteúdo da etiqueta e do código do modelo. */

/** Código do modelo: 4 dígitos, a partir de 0001. */
export function formatarCodigo(numero: number): string {
  if (!Number.isInteger(numero) || numero < 1 || numero > 9999) {
    throw new Error(`Código fora da faixa 0001–9999: ${numero}`);
  }
  return String(numero).padStart(4, "0");
}

/** Próximo código livre, dado o maior número já usado. */
export function proximoCodigo(maiorUsado: number | null | undefined): string {
  return formatarCodigo((maiorUsado ?? 0) + 1);
}

/** Aceita "123", "0123" ou o texto lido do QR e devolve "0123"; null se não for código. */
export function normalizarCodigo(texto: string): string | null {
  const t = texto.trim();
  if (!/^\d{1,4}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 ? formatarCodigo(n) : null;
}

/**
 * Preço disfarçado: parte inteira do preço, com zeros à esquerda (4 dígitos) e invertida.
 * R$ 47,90 → "0047" → "7400". Sem preço → "----".
 */
export function precoDisfarcado(precoCentavos: number | null | undefined): string {
  if (precoCentavos == null || precoCentavos <= 0) return "----";
  const inteiro = String(Math.floor(precoCentavos / 100)).padStart(4, "0");
  return inteiro.split("").reverse().join("");
}

/** Desfaz o disfarce: "7400" → 47 (reais inteiros). Útil para conferir uma etiqueta na mão. */
export function lerPrecoDisfarcado(texto: string): number | null {
  if (!/^\d{4,}$/.test(texto)) return null;
  return Number(texto.split("").reverse().join(""));
}

/** As duas linhas de texto à direita do QR. */
export function linhasEtiqueta(codigo: string, precoCentavos: number | null | undefined): [string, string] {
  return [codigo, precoDisfarcado(precoCentavos)];
}

/** O QR só leva o código do modelo, nunca o preço. */
export function conteudoQr(codigo: string): string {
  return codigo;
}

/** Precisa reimprimir quando o preço atual difere do que foi impresso. */
export function precisaReimprimir(
  precoAtualCentavos: number | null | undefined,
  precoImpressoCentavos: number | null | undefined,
): boolean {
  return (precoAtualCentavos ?? null) !== (precoImpressoCentavos ?? null);
}
