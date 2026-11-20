import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { BancoEsplendida } from "./db";
import {
  abrirSessao, atualizarModelo, cadastrarMontinho, criarLocal, listarPendencias,
  saldoPorLocal, salvarFoto, somarAoModelo, vendi1,
} from "./repositorio";
import { paraLinhaRemota, sincronizar, type Remoto } from "./sincronizar";

let db: BancoEsplendida;
beforeEach(async () => {
  db = new BancoEsplendida(`teste-${crypto.randomUUID()}`);
  await db.open();
});

function remotoFalso(falharEm?: string) {
  const linhas = new Map<string, Record<string, unknown>>();
  const arquivos: string[] = [];
  const ordem: string[] = [];
  const catalogo: Record<string, unknown>[] = [];
  const remoto: Remoto = {
    async upsert(tabela, linha) {
      if (tabela === falharEm) throw new Error("sem rede");
      linhas.set(`${tabela}:${linha.id}`, linha);
      ordem.push(tabela);
    },
    async enviarArquivo(caminho) { arquivos.push(caminho); },
    async substituirCatalogo(l) { catalogo.push(...l); },
    async userId() { return "u1"; },
  };
  return { remoto, linhas, arquivos, ordem, catalogo };
}

const blob = () => new Blob(["x"], { type: "image/webp" });

describe("cadastro offline", () => {
  it("gera códigos sequenciais, entrada no local e pendências", async () => {
    const casa = await criarLocal(db, "Casa");
    const sessao = await abrirSessao(db, "Gaveta 2 do quarto", casa.id);
    const a = await cadastrarMontinho(db, { dados: { nome: "Brinco Glow Rosé", categoria: "Brinco", banho: "Rosé" }, quantidade: 3, sessao });
    const b = await cadastrarMontinho(db, { dados: { nome: "" }, quantidade: 1, sessao });
    expect(a.modelo.codigo).toBe("0001");
    expect(b.modelo.codigo).toBe("0002");
    expect((await saldoPorLocal(db, a.modelo.id)).get(casa.id)).toBe(3);

    await somarAoModelo(db, { modeloId: a.modelo.id, quantidade: 2, sessao });
    await vendi1(db, a.modelo.id, casa.id);
    expect((await saldoPorLocal(db, a.modelo.id)).get(casa.id)).toBe(4);

    const pend = await listarPendencias(db);
    expect(pend.find((p) => p.modelo.id === b.modelo.id)?.faltando).toEqual(["nome", "preco", "foto", "referencia"]);
  });

  it("fica completo quando ganha foto, referência e custo", async () => {
    const casa = await criarLocal(db, "Casa");
    const sessao = await abrirSessao(db, "Caixa", casa.id);
    const { modelo } = await cadastrarMontinho(db, { dados: { nome: "Anel Gota", referencia: "R1", custoCentavos: 1900 }, quantidade: 1, sessao });
    expect((await db.modelos.get(modelo.id))?.status).toBe("rascunho");
    await salvarFoto(db, { modeloId: modelo.id, imagem: blob(), miniatura: blob() });
    expect((await db.modelos.get(modelo.id))?.status).toBe("completo");
    await atualizarModelo(db, modelo.id, { referencia: "" });
    expect((await db.modelos.get(modelo.id))?.status).toBe("rascunho");
  });

  it("não duplica itens na fila para o mesmo registro", async () => {
    const casa = await criarLocal(db, "Casa");
    const sessao = await abrirSessao(db, "Caixa", casa.id);
    const { modelo } = await cadastrarMontinho(db, { dados: { nome: "X" }, quantidade: 1, sessao });
    await atualizarModelo(db, modelo.id, { nome: "Y" });
    await atualizarModelo(db, modelo.id, { nome: "Z" });
    const itensModelo = (await db.fila.toArray()).filter((i) => i.tabela === "modelo");
    expect(itensModelo).toHaveLength(1);
  });
});

describe("sincronização", () => {
  it("envia tudo na ordem das chaves estrangeiras, com fotos, e esvazia a fila", async () => {
    const casa = await criarLocal(db, "Casa");
    const sessao = await abrirSessao(db, "Caixa", casa.id);
    const { modelo } = await cadastrarMontinho(db, { dados: { nome: "Brinco", custoCentavos: 1900 }, quantidade: 2, sessao });
    const foto = await salvarFoto(db, { modeloId: modelo.id, imagem: blob(), miniatura: blob() });

    const r = remotoFalso();
    const res = await sincronizar(db, r.remoto);
    expect(res).toEqual({ enviados: 5, falhas: 0, restantes: 0 });
    expect(r.ordem).toEqual(["local", "sessao_contagem", "modelo", "foto_modelo", "movimentacao"]);
    expect(r.arquivos).toEqual([`u1/${modelo.id}/${foto.id}.webp`, `u1/${modelo.id}/${foto.id}_mini.webp`]);
    const linhaModelo = r.linhas.get(`modelo:${modelo.id}`)!;
    expect(linhaModelo).toMatchObject({ codigo: "0001", custo_centavos: 1900, status: "rascunho" });
    expect(r.linhas.get(`foto_modelo:${foto.id}`)).not.toHaveProperty("imagem");
  });

  it("guarda na fila o que falhou e não envia filhos de pai que falhou", async () => {
    const casa = await criarLocal(db, "Casa");
    const sessao = await abrirSessao(db, "Caixa", casa.id);
    await cadastrarMontinho(db, { dados: { nome: "Brinco" }, quantidade: 2, sessao });

    const r = remotoFalso("modelo");
    const res = await sincronizar(db, r.remoto);
    expect(res.falhas).toBe(1);
    expect(r.ordem).toEqual(["local", "sessao_contagem"]);
    expect(res.restantes).toBe(2); // modelo + movimentação esperam
    const item = (await db.fila.toArray()).find((i) => i.tabela === "modelo")!;
    expect(item.tentativas).toBe(1);
    expect(item.ultimoErro).toBe("sem rede");

    const ok = remotoFalso();
    expect(await sincronizar(db, ok.remoto)).toEqual({ enviados: 2, falhas: 0, restantes: 0 });
  });

  it("converte nomes para snake_case", () => {
    expect(paraLinhaRemota("movimentacao", { localOrigemId: "a", sessaoId: undefined, data: "d" }))
      .toEqual({ local_origem_id: "a", data: "d" });
  });
});
