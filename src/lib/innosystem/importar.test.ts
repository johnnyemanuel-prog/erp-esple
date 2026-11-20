import { describe, expect, it } from "vitest";
import {
  categoriaDoGrupo, codigoDaEtiquetaInnosystem, digitoEan, lerCsv,
  lerExportacaoInnosystem, normalizarReferencia,
} from "./importar";

// Amostra no formato real da exportação "Tabela de Preço" (UTF-8 com BOM, ";", CRLF).
const CSV =
  "﻿código;barras;nome;quantidade;custo;preço;tamanho;cor;ref;idfornecedor;nomefornecedor;idgrupo;grupo;minimo;dtinc;nrncm\r\n" +
  "1389;213899;PG PROMESSA 1389;1;299,00;747,50;;;25981;6;HERRERA;7;Pingentes;0;10/10/26;\r\n" +
  "1189;211895;COLAR CRUCIFIXO PEROLA LUXO 1189;1;78,50;196,25;;;MAS-358382;3;MASTER;6;Colares;0;05/10/26;\r\n" +
  "789;1230000255479;AN GEOMETRICO PETIT 789;3;119,00;297,50;;;25547;6;HERRERA;3;Anéis;0;18/05/26;\r\n" +
  "967;209676;PULSEIRA RIVIERA KAROLINA 967;1;50,00;125,00;;;1;3;MASTER;0;-nenhum-;0;27/06/26;\r\n" +
  "322;203221;ANEL GOTA LUXO 185;1;39,98;99,95;;;MAS-103592;3;MASTER;3;Anéis;0;20/04/26;\r\n" +
  "846;208465;Peças diversas faixa11 14990 846;0;;149,90;;;;;;9;Diversos;0;20/04/26;\r\n";

describe("leitura da exportação do Innosystem", () => {
  const { itens, avisos } = lerExportacaoInnosystem(CSV);
  const por = (c: string) => itens.find((i) => i.codigoInnosystem === c)!;

  it("lê todas as linhas sem avisos", () => {
    expect(itens).toHaveLength(6);
    expect(avisos).toEqual([]);
  });
  it("nome sugerido expande abreviação e tira a numeração do fim", () => {
    expect(por("1389").nomeSugerido).toBe("Pingente Promessa");
    expect(por("789").nomeSugerido).toBe("Anel Geometrico Petit");
    expect(por("322").nomeSugerido).toBe("Anel Gota Luxo"); // 185 = numeração antiga
  });
  it("categoria pelo grupo, e pelo nome quando o grupo é '-nenhum-'", () => {
    expect(por("1389").categoria).toBe("Pingente");
    expect(por("789").categoria).toBe("Anel");
    expect(por("967").categoria).toBe("Pulseira");
    expect(por("846").categoria).toBeNull();
  });
  it("custo, preço, referência e data", () => {
    expect(por("1189")).toMatchObject({
      custoCentavos: 7850, precoCentavos: 19625, referencia: "MAS-358382",
      referenciaNormalizada: "358382", fornecedora: "MASTER", incluidoEm: "2026-10-05",
    });
    expect(por("846").custoCentavos).toBeNull();
  });
  it("recusa arquivo de outro formato", () => {
    expect(lerExportacaoInnosystem("a;b\n1;2").avisos[0]).toMatch(/Não parece/);
  });
});

describe("etiqueta antiga do Innosystem", () => {
  it("decodifica 2 + código + verificador", () => {
    expect(digitoEan("21389")).toBe(9);
    expect(codigoDaEtiquetaInnosystem("213899")).toBe("1389");
    expect(codigoDaEtiquetaInnosystem("200189")).toBe("18");
  });
  it("recusa verificador errado e outros formatos", () => {
    expect(codigoDaEtiquetaInnosystem("213898")).toBeNull();
    expect(codigoDaEtiquetaInnosystem("1230000255479")).toBeNull();
  });
});

describe("auxiliares", () => {
  it("CSV com aspas", () => {
    expect(lerCsv('a;"b;c";"d ""e"""\r\n')).toEqual([["a", "b;c", 'd "e"']]);
  });
  it("grupos e referências", () => {
    expect(categoriaDoGrupo("COLAR")).toBe("Colar");
    expect(categoriaDoGrupo("Anéis")).toBe("Anel");
    expect(categoriaDoGrupo("Embalagens")).toBeNull();
    expect(normalizarReferencia("HER-25608")).toBe("25608");
    expect(normalizarReferencia("BR10530C")).toBe("BR10530C");
    expect(normalizarReferencia("")).toBeNull();
  });
});
