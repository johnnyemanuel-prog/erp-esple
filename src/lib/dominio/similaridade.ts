/** Comparação de fotos por vetores (embeddings) calculados no celular. */

/** Modelo e versão do vetor: vetores de modelos diferentes não se comparam. */
export const MODELO_VISAO = "mobileclip_s0-fp16";

/** A partir daqui, "parece com" no cadastro (aviso de duplicata). */
export const LIMIAR_PARECIDO = 0.8;
/** Abaixo disso, nem aparece como candidata na busca por foto. */
export const LIMIAR_CANDIDATO = 0.55;

export function normalizarVetor(v: ArrayLike<number>): number[] {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  return Array.from(v, (x) => x / n);
}

/** Cosseno entre dois vetores já normalizados. */
export function similaridade(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) return -1;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export interface FotoIndexada {
  modeloId: string;
  embedding?: number[] | null;
  embeddingModelo?: string | null;
}

export interface Candidato {
  modeloId: string;
  similaridade: number;
}

/**
 * Os modelos mais parecidos com a foto: cada modelo vale pela sua foto mais parecida.
 * Ignora fotos sem vetor ou de outro modelo de IA.
 */
export function rankearModelos(
  consulta: number[],
  fotos: FotoIndexada[],
  opcoes: { limite?: number; minimo?: number; ignorarModeloId?: string } = {},
): Candidato[] {
  const { limite = 5, minimo = LIMIAR_CANDIDATO, ignorarModeloId } = opcoes;
  const melhor = new Map<string, number>();
  for (const f of fotos) {
    if (!f.embedding || f.embeddingModelo !== MODELO_VISAO || f.modeloId === ignorarModeloId) continue;
    const s = similaridade(consulta, f.embedding);
    if (s > (melhor.get(f.modeloId) ?? -Infinity)) melhor.set(f.modeloId, s);
  }
  return [...melhor]
    .filter(([, s]) => s >= minimo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([modeloId, s]) => ({ modeloId, similaridade: s }));
}
