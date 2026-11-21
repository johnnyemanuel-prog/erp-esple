/**
 * Operações de escrita no celular. Cada uma grava no banco local e põe o registro
 * na fila de sincronização, na mesma transação: ou as duas coisas acontecem, ou nenhuma.
 */
import { formatarCodigo } from "@/lib/dominio/etiqueta";
import { pendencias, statusModelo } from "@/lib/dominio/pendencias";
import { precoAtual } from "@/lib/dominio/preco";
import type { BancoEsplendida, Modelo, Movimentacao, SessaoContagem, TabelaSincronizada } from "./db";

const agora = () => new Date().toISOString();
const novoId = () => crypto.randomUUID();

const TABELA_LOCAL: Record<TabelaSincronizada, keyof BancoEsplendida> = {
  local: "locais",
  fornecedora: "fornecedoras",
  sessao_contagem: "sessoes",
  modelo: "modelos",
  foto_modelo: "fotos",
  movimentacao: "movimentacoes",
};

export function tabelaLocal(db: BancoEsplendida, t: TabelaSincronizada) {
  return db[TABELA_LOCAL[t]] as unknown as import("dexie").Table<{ id: string }, string>;
}

/** Põe na fila, sem duplicar: se já há item pendente para o mesmo registro, não cria outro. */
async function enfileirar(db: BancoEsplendida, tabela: TabelaSincronizada, registroId: string) {
  const existe = await db.fila.where("[tabela+registroId]").equals([tabela, registroId]).first();
  if (!existe) await db.fila.add({ tabela, registroId, criadoEm: agora(), tentativas: 0 });
}

/** Próximo código de modelo (0001, 0002…). Só o celular cadastra, então um contador local basta. */
export async function reservarCodigo(db: BancoEsplendida): Promise<string> {
  return db.transaction("rw", db.meta, db.modelos, async () => {
    const meta = await db.meta.get("ultimoCodigo");
    let ultimo = typeof meta?.valor === "number" ? meta.valor : 0;
    // Protege contra contador perdido (ex.: dados restaurados): nunca abaixo do maior existente.
    const maior = await db.modelos.orderBy("codigo").last();
    if (maior) ultimo = Math.max(ultimo, Number(maior.codigo));
    const codigo = formatarCodigo(ultimo + 1);
    await db.meta.put({ chave: "ultimoCodigo", valor: ultimo + 1 });
    return codigo;
  });
}

export async function criarLocal(db: BancoEsplendida, nome: string) {
  const local = { id: novoId(), nome: nome.trim(), ativo: true, atualizadoEm: agora() };
  await db.transaction("rw", db.locais, db.fila, async () => {
    await db.locais.add(local);
    await enfileirar(db, "local", local.id);
  });
  return local;
}

export async function abrirSessao(db: BancoEsplendida, nome: string, localId: string): Promise<SessaoContagem> {
  const sessao: SessaoContagem = { id: novoId(), nome: nome.trim(), localId, inicio: agora(), atualizadoEm: agora() };
  await db.transaction("rw", db.sessoes, db.fila, async () => {
    await db.sessoes.add(sessao);
    await enfileirar(db, "sessao_contagem", sessao.id);
  });
  return sessao;
}

export async function fecharSessao(db: BancoEsplendida, sessaoId: string) {
  await db.transaction("rw", db.sessoes, db.fila, async () => {
    await db.sessoes.update(sessaoId, { fim: agora(), atualizadoEm: agora() });
    await enfileirar(db, "sessao_contagem", sessaoId);
  });
}

export type DadosModelo = Omit<Modelo, "id" | "codigo" | "status" | "criadoEm" | "atualizadoEm">;

async function recalcularStatus(db: BancoEsplendida, modelo: Modelo): Promise<Modelo["status"]> {
  const qtdFotos = await db.fotos.where("modeloId").equals(modelo.id).count();
  return statusModelo({ ...modelo, qtdFotos });
}

/**
 * Cadastro rápido de um montinho: cria o modelo e a entrada no local da sessão.
 * Fotos são salvas à parte (salvarFoto), porque a compressão é assíncrona.
 */
export async function cadastrarMontinho(
  db: BancoEsplendida,
  args: { dados: DadosModelo; quantidade: number; sessao: SessaoContagem },
): Promise<{ modelo: Modelo; movimentacao: Movimentacao }> {
  const codigo = await reservarCodigo(db);
  const t = agora();
  const modelo: Modelo = { ...args.dados, id: novoId(), codigo, status: "rascunho", criadoEm: t, atualizadoEm: t };
  modelo.status = statusModelo({ ...modelo, qtdFotos: 0 });
  const movimentacao: Movimentacao = {
    id: novoId(),
    modeloId: modelo.id,
    localDestinoId: args.sessao.localId,
    quantidade: args.quantidade,
    tipo: "entrada",
    sessaoId: args.sessao.id,
    data: t,
    atualizadoEm: t,
  };
  await db.transaction("rw", db.modelos, db.movimentacoes, db.fila, async () => {
    await db.modelos.add(modelo);
    await db.movimentacoes.add(movimentacao);
    await enfileirar(db, "modelo", modelo.id);
    await enfileirar(db, "movimentacao", movimentacao.id);
  });
  return { modelo, movimentacao };
}

/** "Somar a um modelo existente": só uma nova entrada, sem criar modelo. */
export async function somarAoModelo(
  db: BancoEsplendida,
  args: { modeloId: string; quantidade: number; sessao: SessaoContagem },
): Promise<Movimentacao> {
  return registrarMovimentacao(db, {
    modeloId: args.modeloId,
    localDestinoId: args.sessao.localId,
    quantidade: args.quantidade,
    tipo: "entrada",
    sessaoId: args.sessao.id,
  });
}

/** Botão "vendi 1": baixa no estoque do local escolhido. */
export async function vendi1(db: BancoEsplendida, modeloId: string, localId: string) {
  return registrarMovimentacao(db, { modeloId, localOrigemId: localId, quantidade: 1, tipo: "venda" });
}

export async function registrarMovimentacao(
  db: BancoEsplendida,
  dados: Omit<Movimentacao, "id" | "data" | "atualizadoEm">,
): Promise<Movimentacao> {
  if (!Number.isInteger(dados.quantidade) || dados.quantidade < 1) throw new Error("Quantidade inválida");
  const t = agora();
  const mov: Movimentacao = { ...dados, id: novoId(), data: t, atualizadoEm: t };
  await db.transaction("rw", db.movimentacoes, db.fila, async () => {
    await db.movimentacoes.add(mov);
    await enfileirar(db, "movimentacao", mov.id);
  });
  return mov;
}

export async function atualizarModelo(db: BancoEsplendida, id: string, mudancas: Partial<DadosModelo>) {
  await db.transaction("rw", db.modelos, db.fotos, db.fila, async () => {
    const atual = await db.modelos.get(id);
    if (!atual) throw new Error("Modelo não encontrado");
    const novo: Modelo = { ...atual, ...mudancas, atualizadoEm: agora() };
    novo.status = await recalcularStatus(db, novo);
    await db.modelos.put(novo);
    await enfileirar(db, "modelo", id);
  });
}

export async function salvarFoto(
  db: BancoEsplendida,
  args: { modeloId: string; imagem: Blob; miniatura: Blob },
) {
  const foto = {
    id: novoId(),
    modeloId: args.modeloId,
    imagem: args.imagem,
    miniatura: args.miniatura,
    atualizadoEm: agora(),
    principal: false,
    ordem: 0,
  };
  await db.transaction("rw", db.modelos, db.fotos, db.fila, async () => {
    const qtd = await db.fotos.where("modeloId").equals(args.modeloId).count();
    foto.principal = qtd === 0;
    foto.ordem = qtd;
    await db.fotos.add(foto);
    await enfileirar(db, "foto_modelo", foto.id);
    const modelo = await db.modelos.get(args.modeloId);
    if (modelo) {
      const status = await recalcularStatus(db, modelo);
      if (status !== modelo.status) {
        await db.modelos.update(modelo.id, { status, atualizadoEm: agora() });
        await enfileirar(db, "modelo", modelo.id);
      }
    }
  });
  return foto;
}

/** Saldo de um modelo por local, somando as movimentações locais. */
export async function saldoPorLocal(db: BancoEsplendida, modeloId: string): Promise<Map<string, number>> {
  const saldo = new Map<string, number>();
  const movs = await db.movimentacoes.where("modeloId").equals(modeloId).toArray();
  for (const m of movs) {
    if (m.localDestinoId) saldo.set(m.localDestinoId, (saldo.get(m.localDestinoId) ?? 0) + m.quantidade);
    if (m.localOrigemId) saldo.set(m.localOrigemId, (saldo.get(m.localOrigemId) ?? 0) - m.quantidade);
  }
  return saldo;
}

/** Fila de pendências: rascunhos com o que falta em cada um. */
export async function listarPendencias(db: BancoEsplendida) {
  const rascunhos = await db.modelos.where("status").equals("rascunho").toArray();
  return Promise.all(
    rascunhos.map(async (m) => {
      const qtdFotos = await db.fotos.where("modeloId").equals(m.id).count();
      return { modelo: m, faltando: pendencias({ ...m, qtdFotos }) };
    }),
  );
}

/** Depois de imprimir: guarda o preço que foi para a etiqueta (base da lista "a reimprimir"). */
export async function marcarEtiquetasImpressas(db: BancoEsplendida, modeloIds: string[]) {
  const t = agora();
  await db.transaction("rw", db.modelos, db.fila, async () => {
    for (const id of modeloIds) {
      const m = await db.modelos.get(id);
      if (!m) continue;
      await db.modelos.update(id, {
        precoImpressoCentavos: precoAtual(m).centavos,
        etiquetaImpressaEm: t,
        atualizadoEm: t,
      });
      await enfileirar(db, "modelo", id);
    }
  });
}

/** Modelos cuja etiqueta colada mostra um preço diferente do atual (ou nunca foram impressos). */
export async function listarAReimprimir(db: BancoEsplendida) {
  const todos = await db.modelos.toArray();
  return todos.filter((m) => m.etiquetaImpressaEm && precoAtual(m).centavos !== (m.precoImpressoCentavos ?? null));
}
