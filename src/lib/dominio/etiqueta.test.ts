import { describe, expect, it } from "vitest";
import { formatarCodigo, lerPrecoDisfarcado, linhasEtiqueta, normalizarCodigo, precisaReimprimir, precoDisfarcado, proximoCodigo } from "./etiqueta";

describe("código do modelo", () => {
  it("4 dígitos a partir de 0001", () => {
    expect(proximoCodigo(null)).toBe("0001");
    expect(proximoCodigo(122)).toBe("0123");
    expect(() => formatarCodigo(10000)).toThrow();
  });
  it("normaliza leitura", () => {
    expect(normalizarCodigo(" 123 ")).toBe("0123");
    expect(normalizarCodigo("0000")).toBeNull();
    expect(normalizarCodigo("http://x")).toBeNull();
  });
});

describe("preço disfarçado", () => {
  it("segue o exemplo do spec", () => {
    expect(precoDisfarcado(4790)).toBe("7400");
    expect(lerPrecoDisfarcado("7400")).toBe(47);
  });
  it("rascunho sem preço", () => {
    expect(linhasEtiqueta("0123", null)).toEqual(["0123", "----"]);
  });
  it("preço de 3 e 4 dígitos", () => {
    expect(precoDisfarcado(12990)).toBe("9210");
    expect(precoDisfarcado(123490)).toBe("4321");
  });
});

describe("reimpressão", () => {
  it("compara atual com impresso", () => {
    expect(precisaReimprimir(4790, 4790)).toBe(false);
    expect(precisaReimprimir(4890, 4790)).toBe(true);
    expect(precisaReimprimir(4790, null)).toBe(true);
    expect(precisaReimprimir(null, undefined)).toBe(false);
  });
});
