import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { MODELO_VISAO, normalizarVetor } from "@/lib/dominio/similaridade";
import { BancoEsplendida } from "./db";
import { buscarPorVetor, indexarFotosPendentes } from "./indexar";
import { abrirSessao, cadastrarMontinho, criarLocal, salvarFoto } from "./repositorio";
import { paraLinhaRemota } from "./sincronizar";

let db: BancoEsplendida;
beforeEach(async () => {
  db = new BancoEsplendida(`ia-${crypto.randomUUID()}`);
  await db.open();
});

// "Imagem" falsa: o conteúdo do blob diz qual vetor sai.
const img = (x: number, y: number) => new Blob([JSON.stringify([x, y])]);
const calcular = async (b: Blob) => normalizarVetor(JSON.parse(await b.text()));

describe("busca por foto", () => {
  it("indexa as fotos pendentes, guarda para subir e acha o modelo mais parecido", async () => {
    const casa = await criarLocal(db, "Casa");
    const s = await abrirSessao(db, "S", casa.id);
    const a = (await cadastrarMontinho(db, { dados: { nome: "Brinco gota" }, quantidade: 1, sessao: s })).modelo;
    const b = (await cadastrarMontinho(db, { dados: { nome: "Colar elo" }, quantidade: 1, sessao: s })).modelo;
    await salvarFoto(db, { modeloId: a.id, imagem: img(1, 0), miniatura: img(1, 0) });
    await salvarFoto(db, { modeloId: b.id, imagem: img(0, 1), miniatura: img(0, 1) });
    // Já com vetor: não recalcula.
    await salvarFoto(db, { modeloId: b.id, imagem: img(9, 9), miniatura: img(9, 9), embedding: normalizarVetor([0.1, 1]), embeddingModelo: MODELO_VISAO });

    expect(await indexarFotosPendentes(db, calcular)).toBe(2);
    expect(await indexarFotosPendentes(db, calcular)).toBe(0);

    const r = await buscarPorVetor(db, normalizarVetor([1, 0.15]));
    expect(r[0].modeloId).toBe(a.id);
    expect(r[0].similaridade).toBeGreaterThan(0.95);

    const foto = (await db.fotos.where("modeloId").equals(a.id).first())!;
    const linha = paraLinhaRemota("foto_modelo", foto as unknown as Record<string, unknown>);
    expect(linha).toMatchObject({ embedding_modelo: MODELO_VISAO });
    expect((linha.embedding as number[]).length).toBe(2);
    expect(linha).not.toHaveProperty("imagem");
  });
});
