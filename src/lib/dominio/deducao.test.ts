import { describe, expect, it } from "vitest";
import { deduzirBanho, deduzirCategoria } from "./deducao";

describe("dedução pelo nome", () => {
  it.each([
    ["Brinco Glow Rosé", "Brinco", "Rosé"],
    ["Colar Ponto de Luz Dourado", "Colar", "Dourado"],
    ["Anel Solitário Ródio Negro", "Anel", "Ródio negro"],
    ["Choker Riviera Prata", "Choker", "Prata/ródio"],
    ["Conjunto Brinco e Colar Gota Rose Gold", "Conjunto", "Rosé"],
    ["Argola Lisa Média", "Brinco", null],
    ["Tornozeleira Bolinhas Ródio", "Tornozeleira", "Prata/ródio"],
  ])("%s", (nome, categoria, banho) => {
    expect(deduzirCategoria(nome)).toBe(categoria);
    expect(deduzirBanho(nome)).toBe(banho);
  });
  it("não inventa", () => {
    expect(deduzirCategoria("Peça sem nome claro")).toBeNull();
    expect(deduzirCategoria("")).toBeNull();
  });
});
