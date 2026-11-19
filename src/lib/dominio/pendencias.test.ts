import { describe, expect, it } from "vitest";
import { pendencias, statusModelo } from "./pendencias";

describe("pendências", () => {
  it("rascunho vazio", () => {
    expect(pendencias({ qtdFotos: 0 })).toEqual(["nome", "preco", "foto", "referencia"]);
    expect(statusModelo({ qtdFotos: 0 })).toBe("rascunho");
  });
  it("preço provisório pede custo", () => {
    expect(pendencias({ nome: "X", referencia: "R1", precoProvisorioCentavos: 5990, qtdFotos: 1 })).toEqual(["custo", "foto_extra"]);
  });
  it("completo com só foto extra pendente", () => {
    const m = { nome: "X", referencia: "R1", custoCentavos: 1900, qtdFotos: 1 };
    expect(pendencias(m)).toEqual(["foto_extra"]);
    expect(statusModelo(m)).toBe("completo");
  });
});
