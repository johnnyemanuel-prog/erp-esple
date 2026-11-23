import { describe, expect, it } from "vitest";
import { MODELO_VISAO, normalizarVetor, rankearModelos, similaridade } from "./similaridade";

const v = (...x: number[]) => normalizarVetor(x);
const foto = (modeloId: string, e: number[], m = MODELO_VISAO) => ({ modeloId, embedding: e, embeddingModelo: m });

describe("similaridade", () => {
  it("cosseno de vetores normalizados", () => {
    expect(similaridade(v(1, 0), v(1, 0))).toBeCloseTo(1);
    expect(similaridade(v(1, 0), v(0, 1))).toBeCloseTo(0);
    expect(similaridade(v(1, 0), [1, 0, 0])).toBe(-1);
  });

  it("rankeia por modelo, usando a foto mais parecida de cada um", () => {
    const fotos = [
      foto("A", v(1, 0.1)),
      foto("A", v(0, 1)),
      foto("B", v(1, 0.5)),
      foto("C", v(-1, 0)),
      foto("D", v(1, 0), "outro-modelo"),
      { modeloId: "E", embedding: null },
    ];
    const r = rankearModelos(v(1, 0), fotos);
    expect(r.map((c) => c.modeloId)).toEqual(["A", "B"]);
    expect(r[0].similaridade).toBeGreaterThan(r[1].similaridade);
  });

  it("respeita limite, mínimo e o modelo a ignorar", () => {
    const fotos = [foto("A", v(1, 0)), foto("B", v(1, 0.2)), foto("C", v(1, 0.4))];
    expect(rankearModelos(v(1, 0), fotos, { limite: 2 })).toHaveLength(2);
    expect(rankearModelos(v(1, 0), fotos, { minimo: 0.99 }).map((c) => c.modeloId)).toEqual(["A"]);
    expect(rankearModelos(v(1, 0), fotos, { ignorarModeloId: "A" })[0].modeloId).toBe("B");
  });
});
