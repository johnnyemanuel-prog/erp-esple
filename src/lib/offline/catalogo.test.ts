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

describe("etiqueta genérica (peças diversas)", () => {
  const CSV2 =
    "código;barras;nome;quantidade;custo;preço;tamanho;cor;ref;idfornecedor;nomefornecedor;idgrupo;grupo;minimo;dtinc;nrncm\n" +
    "839;208397;Peças diversas faixa4 4990 839;0;19,96;49,90;;;;;;9;Diversos;0;20/04/26;\n" +
    "1387;213875;BR FLORES DE ALEGRIA 1387;1;89,00;222,50;;;25671;6;HERRERA;4;Brincos;0;06/10/26;\n";

  it("não escolhe sozinho: lista todas as peças daquela faixa", async () => {
    const { lerExportacaoInnosystem } = await import("@/lib/innosystem/importar");
    const { lerCodigo, acharModeloPorLeitura, ehItemGenerico } = await import("./catalogo");
    const { abrirSessao, cadastrarMontinho, criarLocal } = await import("./repositorio");
    await importarCatalogo(db, lerExportacaoInnosystem(CSV2).itens);
    const casa = await criarLocal(db, "Casa");
    const s = await abrirSessao(db, "S", casa.id);
    const a = (await cadastrarMontinho(db, { dados: { nome: "Argola globinho", codigoBarrasInnosystem: "208397" }, quantidade: 1, sessao: s })).modelo;
    const b = (await cadastrarMontinho(db, { dados: { nome: "Brinco coração", codigoBarrasInnosystem: "208397" }, quantidade: 1, sessao: s })).modelo;
    await cadastrarMontinho(db, { dados: { nome: "Brinco flores", codigoBarrasInnosystem: "213875" }, quantidade: 1, sessao: s });

    expect(ehItemGenerico((await db.catalogo.get("839"))!)).toBe(true);
    const r = await lerCodigo(db, "208397");
    expect(r.ambiguo).toBe(true);
    expect(r.modelos.map((m) => m.id)).toEqual([a.id, b.id]);
    expect(r.item?.custoCentavos).toBe(1996);
    expect(await acharModeloPorLeitura(db, "208397")).toBeNull();

    // Código genérico com uma peça só cadastrada também não decide sozinho.
    const so1 = await lerCodigo(db, "208397");
    expect(so1.ambiguo).toBe(true);

    // Etiqueta própria de uma peça: continua indo direto.
    expect((await acharModeloPorLeitura(db, "213875"))?.nome).toBe("Brinco flores");
    expect((await acharModeloPorLeitura(db, "1"))?.id).toBe(a.id);
  });
});
