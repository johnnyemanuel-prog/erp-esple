import { describe, expect, it } from "vitest";
import { etiquetasPorFolha, FOLHA_A4349, posicaoEtiqueta, validarFolha } from "./folha";

describe("folha A4349", () => {
  it("126 por folha e cabe no A4", () => {
    expect(etiquetasPorFolha(FOLHA_A4349)).toBe(126);
    expect(validarFolha(FOLHA_A4349)).toEqual([]);
  });
  it("posições", () => {
    expect(posicaoEtiqueta(FOLHA_A4349, 0)).toMatchObject({ pagina: 0, linha: 0, coluna: 0, xMm: 14, yMm: 13.5 });
    expect(posicaoEtiqueta(FOLHA_A4349, 8)).toMatchObject({ linha: 1, coluna: 1, xMm: 40, yMm: 28.5 });
    expect(posicaoEtiqueta(FOLHA_A4349, 126)).toMatchObject({ pagina: 1, linha: 0, coluna: 0 });
  });
  it("detecta ajuste que sai da página", () => {
    expect(validarFolha({ ...FOLHA_A4349, ajusteXMm: 20 })).not.toEqual([]);
  });
});
