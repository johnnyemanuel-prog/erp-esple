import { describe, expect, it } from "vitest";
import { deduzirBanho, deduzirCategoria, nomeSugerido } from "./deducao";

describe("dedução pelo nome", () => {
  it.each([
    ["Brinco Glow Rosé", "Brinco", "Rosé"],
    ["Colar Ponto de Luz Dourado", "Colar", "Dourado"],
    ["Anel Solitário Ródio Negro", "Anel", "Ródio negro"],
    ["Choker Riviera Prata", "Choker", "Prata/ródio"],
    ["Conjunto Brinco e Colar Gota Rose Gold", "Conjunto", "Rosé"],
    ["Argola Lisa Média", "Brinco", null],
    ["Tornozeleira Bolinhas Ródio", "Tornozeleira", "Prata/ródio"],
    ["BR FLORES DE ALEGRIA 1387", "Brinco", null],
    ["CL BRASILIA 1381", "Colar", null],
    ["PG ALOE 1386", "Pingente", null],
    ["Colar com Pingente Coração", "Colar", null],
    ["Brinco Gota Rose Gold", "Brinco", "Rosé"],
  ])("%s", (nome, categoria, banho) => {
    expect(deduzirCategoria(nome)).toBe(categoria);
    expect(deduzirBanho(nome)).toBe(banho);
  });
  it("não inventa", () => {
    expect(deduzirCategoria("Peça sem nome claro")).toBeNull();
    expect(deduzirCategoria("")).toBeNull();
  });
});

describe("nome sugerido", () => {
  it.each([
    ["BR FLORES DE ALEGRIA 1387", "Brinco Flores de Alegria"],
    ["CL MAESTRINHO XVII 1384", "Colar Maestrinho XVII"],
    ["EMBALAGEM TARRACHA CORE C/05 1111", "Embalagem Tarracha Core C/05"],
    ["CL MUSICA 40CMM 39 PEDRAS P", "Colar Musica 40CMM 39 Pedras P"],
    ["BR LETIZIA", "Brinco Letizia"],
  ])("%s", (original, esperado) => {
    expect(nomeSugerido(original)).toBe(esperado);
  });
});
