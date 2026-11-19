import { describe, expect, it } from "vitest";
import { aplicarDesconto, arredondarPara90, lerReais, precoAtual, precoTabela } from "./preco";

describe("arredondarPara90", () => {
  it("segue os exemplos do spec", () => {
    expect(arredondarPara90(4750)).toBe(4790);
    expect(arredondarPara90(4795)).toBe(4890);
  });
  it("não sobe quem já termina em ,90", () => {
    expect(arredondarPara90(4790)).toBe(4790);
  });
  it("sobe ,91 para o próximo real", () => {
    expect(arredondarPara90(4791)).toBe(4890);
    expect(arredondarPara90(4700)).toBe(4790);
  });
  it("trata meio centavo subindo", () => {
    expect(arredondarPara90(4790.5)).toBe(4890);
  });
});

describe("precoTabela", () => {
  it("custo × 2,5 arredondado para ,90", () => {
    expect(precoTabela(1900)).toBe(4790); // 47,50
    expect(precoTabela(1918)).toBe(4890); // 47,95
    expect(precoTabela(1916)).toBe(4790); // 47,90
    expect(precoTabela(1)).toBe(90); // 0,025 → 0,90
  });
  it("recusa custo inválido", () => {
    expect(() => precoTabela(0)).toThrow();
  });
});

describe("precoAtual", () => {
  it("prefere a tabela, depois o provisório", () => {
    expect(precoAtual({ custoCentavos: 1900, precoProvisorioCentavos: 9990 })).toEqual({ centavos: 4790, origem: "tabela" });
    expect(precoAtual({ precoProvisorioCentavos: 5990 })).toEqual({ centavos: 5990, origem: "provisorio" });
    expect(precoAtual({})).toEqual({ centavos: null, origem: "sem_preco" });
  });
});

describe("aplicarDesconto", () => {
  it("desconto em % e alerta abaixo de custo × 1,5", () => {
    const r = aplicarDesconto(4790, { tipo: "percentual", valor: 10 }, 1900);
    expect(r.precoFinalCentavos).toBe(4311);
    expect(r.abaixoDoMinimo).toBe(false);
    const r2 = aplicarDesconto(4790, { tipo: "reais", centavos: 2000 }, 1900);
    expect(r2.precoFinalCentavos).toBe(2790);
    expect(r2.abaixoDoMinimo).toBe(true); // 27,90 < 28,50
    expect(r2.margemCentavos).toBe(890);
  });
  it("fator configurável e sem custo", () => {
    expect(aplicarDesconto(4790, null, 1900, 3).abaixoDoMinimo).toBe(true);
    expect(aplicarDesconto(4790, { tipo: "reais", centavos: 4000 }, null).abaixoDoMinimo).toBe(false);
  });
  it("desconto não passa do preço", () => {
    expect(aplicarDesconto(4790, { tipo: "reais", centavos: 99999 }, null).precoFinalCentavos).toBe(0);
  });
});

describe("lerReais", () => {
  it("lê formatos comuns", () => {
    expect(lerReais("47,5")).toBe(4750);
    expect(lerReais("47.50")).toBe(4750);
    expect(lerReais("R$ 1.047,90")).toBe(104790);
    expect(lerReais("abc")).toBeNull();
  });
});
