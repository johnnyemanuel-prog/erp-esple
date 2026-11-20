import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { lerExportacaoInnosystem } from "@/lib/innosystem/importar";
import { BancoEsplendida } from "./db";
import { buscarPorCodigoBarras, buscarPorNome, importarCatalogo, preencherDoCatalogo } from "./catalogo";
import { sincronizar, type Remoto } from "./sincronizar";

const CSV =
  "código;barras;nome;quantidade;custo;preço;tamanho;cor;ref;idfornecedor;nomefornecedor;idgrupo;grupo;minimo;dtinc;nrncm\n" +
  "1387;213875;BR FLORES DE ALEGRIA 1387;1;89,00;222,50;;;25671;6;HERRERA;4;Brincos;0;06/10/26;\n" +
  "1376;213769;BR CORACAO EM FLOR 1376;2;209,00;522,50;;;25308;6;HERRERA;4;Brincos;0;06/10/26;\n" +
  "1377;213776;PG CORACAO EM FLOR 1377;2;199,00;497,50;;;25309;6;HERRERA;7;Pingentes;0;06/10/26;\n" +
  "789;1230000255479;AN GEOMETRICO PETIT 789;3;119,00;297,50;;;25547;6;HERRERA;3;Anéis;0;18/05/26;\n";

let db: BancoEsplendida;
beforeEach(async () => {
  db = new BancoEsplendida(`cat-${crypto.randomUUID()}`);
  await importarCatalogo(db, lerExportacaoInnosystem(CSV).itens);
});

describe("catálogo no celular", () => {
  it("acha pelo código de barras exato e pela etiqueta própria", async () => {
    expect((await buscarPorCodigoBarras(db, "1230000255479"))?.codigoInnosystem).toBe("789");
    expect((await buscarPorCodigoBarras(db, " 213875 "))?.codigoInnosystem).toBe("1387");
    expect(await buscarPorCodigoBarras(db, "999999")).toBeNull();
  });

  it("autocompleta por pedaços do nome, sem acento, mais recentes primeiro", async () => {
    const r = await buscarPorNome(db, "coração flo");
    expect(r.map((i) => i.codigoInnosystem)).toEqual(["1377", "1376"]);
    expect((await buscarPorNome(db, "brinco cora")).map((i) => i.codigoInnosystem)).toEqual(["1376"]);
    expect(await buscarPorNome(db, "  ")).toEqual([]);
  });

  it("pré-preenche o cadastro", async () => {
    const it = (await buscarPorCodigoBarras(db, "213875"))!;
    expect(preencherDoCatalogo(it)).toMatchObject({
      nome: "Brinco Flores de Alegria", referencia: "25671", categoria: "Brinco",
      custoCentavos: 8900, codigoBarrasInnosystem: "213875",
    });
  });

  it("sobe o catálogo uma vez, em lote", async () => {
    const enviados: Record<string, unknown>[][] = [];
    const remoto: Remoto = {
      async upsert() {}, async enviarArquivo() {}, async userId() { return "u1"; },
      async substituirCatalogo(l) { enviados.push(l); },
    };
    await sincronizar(db, remoto);
    await sincronizar(db, remoto);
    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toHaveLength(4);
    expect(enviados[0][0]).toHaveProperty("codigo_innosystem");
  });
});
