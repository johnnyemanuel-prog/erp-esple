/**
 * Indexação das fotos para a busca por foto: calcula o vetor de cada foto que ainda não tem
 * (ou que foi calculado por outro modelo de IA) e o guarda, para subir ao servidor também.
 */
import { MODELO_VISAO, rankearModelos, type Candidato } from "@/lib/dominio/similaridade";
import type { BancoEsplendida, FotoModelo } from "./db";
import { enfileirarFoto } from "./repositorio";

export type CalcularVetor = (imagem: Blob) => Promise<number[]>;
export type ObterImagem = (foto: FotoModelo) => Promise<Blob | null>;

export function precisaIndexar(f: FotoModelo) {
  return !f.embedding || f.embeddingModelo !== MODELO_VISAO;
}

/** Indexa as fotos pendentes, uma de cada vez. Devolve quantas indexou. */
export async function indexarFotosPendentes(
  db: BancoEsplendida,
  calcular: CalcularVetor,
  obterImagem: ObterImagem = async (f) => f.imagem ?? f.miniatura ?? null,
  opcoes: { limite?: number; parar?: () => boolean } = {},
): Promise<number> {
  const pendentes = (await db.fotos.toArray()).filter(precisaIndexar).slice(0, opcoes.limite ?? Infinity);
  let feitas = 0;
  for (const f of pendentes) {
    if (opcoes.parar?.()) break;
    const imagem = await obterImagem(f).catch(() => null);
    if (!imagem) continue;
    const embedding = await calcular(imagem);
    await gravarVetor(db, f.id, embedding);
    feitas++;
  }
  return feitas;
}

export async function gravarVetor(db: BancoEsplendida, fotoId: string, embedding: number[]) {
  await db.transaction("rw", db.fotos, db.fila, async () => {
    await db.fotos.update(fotoId, { embedding, embeddingModelo: MODELO_VISAO });
    await enfileirarFoto(db, fotoId);
  });
}

/** Modelos já cadastrados mais parecidos com a foto. */
export async function buscarPorVetor(
  db: BancoEsplendida,
  consulta: number[],
  opcoes?: Parameters<typeof rankearModelos>[2],
): Promise<Candidato[]> {
  const fotos = await db.fotos.toArray();
  return rankearModelos(consulta, fotos, opcoes);
}
