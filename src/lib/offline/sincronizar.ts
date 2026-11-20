/**
 * Envia a fila do celular para o Supabase. Idempotente: os ids são gerados no celular
 * e o envio é um upsert, então reenviar o mesmo item não duplica nada.
 *
 * O remoto é uma interface, para testar sem rede; `remotoSupabase` liga ao cliente real.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BancoEsplendida, FotoModelo, ItemCatalogo, ItemFila, TabelaSincronizada } from "./db";
import { tabelaLocal } from "./repositorio";

export interface Remoto {
  upsert(tabela: TabelaSincronizada, linha: Record<string, unknown>): Promise<void>;
  /** Catálogo do Innosystem, em lotes; substitui o que houver no servidor. */
  substituirCatalogo(linhas: Record<string, unknown>[]): Promise<void>;
  enviarArquivo(caminho: string, arquivo: Blob): Promise<void>;
  userId(): Promise<string>;
}

/** Ordem de envio que respeita as chaves estrangeiras. */
const ORDEM: TabelaSincronizada[] = ["local", "fornecedora", "sessao_contagem", "modelo", "foto_modelo", "movimentacao"];

/** camelCase → snake_case, descartando campos que só existem no aparelho. */
export function paraLinhaRemota(tabela: TabelaSincronizada, registro: Record<string, unknown>) {
  const linha: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(registro)) {
    if (v === undefined) continue;
    if (tabela === "foto_modelo" && (k === "imagem" || k === "miniatura")) continue;
    linha[k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = v;
  }
  return linha;
}

export interface ResultadoSync {
  enviados: number;
  falhas: number;
  restantes: number;
}

let emAndamento: Promise<ResultadoSync> | null = null;

/** Evita duas sincronizações ao mesmo tempo (ex.: evento "online" + botão). */
export function sincronizar(db: BancoEsplendida, remoto: Remoto): Promise<ResultadoSync> {
  emAndamento ??= executar(db, remoto).finally(() => {
    emAndamento = null;
  });
  return emAndamento;
}

async function executar(db: BancoEsplendida, remoto: Remoto): Promise<ResultadoSync> {
  const fila = await db.fila.toArray();
  fila.sort((a, b) => ORDEM.indexOf(a.tabela) - ORDEM.indexOf(b.tabela) || a.seq! - b.seq!);

  let enviados = 0;
  let falhas = 0;
  const userId = fila.length ? await remoto.userId() : "";
  const falhouTabela = new Set<TabelaSincronizada>();

  for (const item of fila) {
    // Se um pai falhou, os filhos esperam a próxima rodada (evita erro de chave estrangeira).
    if (ORDEM.slice(0, ORDEM.indexOf(item.tabela)).some((t) => falhouTabela.has(t))) continue;
    try {
      await enviarItem(db, remoto, item, userId);
      await db.fila.delete(item.seq!);
      enviados++;
    } catch (e) {
      falhas++;
      falhouTabela.add(item.tabela);
      await db.fila.update(item.seq!, {
        tentativas: item.tentativas + 1,
        ultimoErro: e instanceof Error ? e.message : String(e),
      });
    }
  }
  if ((await db.meta.get("catalogoPendente"))?.valor === true) {
    try {
      const itens = await db.catalogo.toArray();
      await remoto.substituirCatalogo(itens.map(paraLinhaCatalogo));
      await db.meta.put({ chave: "catalogoPendente", valor: false });
    } catch {
      falhas++;
    }
  }
  return { enviados, falhas, restantes: await db.fila.count() };
}

export function paraLinhaCatalogo(it: ItemCatalogo): Record<string, unknown> {
  return {
    codigo_innosystem: it.codigoInnosystem,
    codigo_barras: it.codigoBarras,
    nome: it.nome,
    nome_sugerido: it.nomeSugerido,
    referencia: it.referencia,
    referencia_normalizada: it.referenciaNormalizada,
    categoria: it.categoria,
    grupo_original: it.grupoOriginal,
    custo_centavos: it.custoCentavos,
    preco_centavos: it.precoCentavos,
    fornecedora: it.fornecedora,
    cor: it.cor,
    ncm: it.ncm,
    incluido_em: it.incluidoEm,
    dados: it.dados,
  };
}

async function enviarItem(db: BancoEsplendida, remoto: Remoto, item: ItemFila, userId: string) {
  const registro = (await tabelaLocal(db, item.tabela).get(item.registroId)) as Record<string, unknown> | undefined;
  if (!registro) return; // apagado no aparelho antes de subir: nada a enviar

  if (item.tabela === "foto_modelo") {
    const foto = registro as unknown as FotoModelo;
    if (!foto.caminho && foto.imagem && foto.miniatura) {
      const base = `${userId}/${foto.modeloId}/${foto.id}`;
      await remoto.enviarArquivo(`${base}.webp`, foto.imagem);
      await remoto.enviarArquivo(`${base}_mini.webp`, foto.miniatura);
      // Guarda os caminhos; a imagem continua no aparelho para uso offline.
      await db.fotos.update(foto.id, { caminho: `${base}.webp`, caminhoMiniatura: `${base}_mini.webp` });
      registro.caminho = `${base}.webp`;
      registro.caminhoMiniatura = `${base}_mini.webp`;
    }
  }

  await remoto.upsert(item.tabela, paraLinhaRemota(item.tabela, registro));
}

export function remotoSupabase(supabase: SupabaseClient): Remoto {
  return {
    async upsert(tabela, linha) {
      const { error } = await supabase.from(tabela).upsert(linha, { onConflict: "id" });
      if (error) throw new Error(`${tabela}: ${error.message}`);
    },
    async substituirCatalogo(linhas) {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão: entre de novo para sincronizar.");
      const userId = u.user.id;
      for (let i = 0; i < linhas.length; i += 500) {
        const lote = linhas.slice(i, i + 500).map((l) => ({ ...l, user_id: userId }));
        const { error } = await supabase
          .from("catalogo_innosystem")
          .upsert(lote, { onConflict: "user_id,codigo_innosystem" });
        if (error) throw new Error(`catálogo: ${error.message}`);
      }
      // O que sumiu da exportação nova sai do catálogo do servidor.
      const codigos = linhas.map((l) => String(l.codigo_innosystem));
      const existentes: string[] = [];
      for (let de = 0; ; de += 1000) {
        // O servidor devolve no máximo 1.000 linhas por consulta.
        const { data, error } = await supabase
          .from("catalogo_innosystem")
          .select("codigo_innosystem")
          .order("codigo_innosystem")
          .range(de, de + 999);
        if (error) throw new Error(`catálogo: ${error.message}`);
        existentes.push(...(data ?? []).map((e) => e.codigo_innosystem as string));
        if (!data || data.length < 1000) break;
      }
      const manter = new Set(codigos);
      const remover = existentes.filter((c) => !manter.has(c));
      for (let i = 0; i < remover.length; i += 200) {
        const { error: e } = await supabase
          .from("catalogo_innosystem")
          .delete()
          .in("codigo_innosystem", remover.slice(i, i + 200));
        if (e) throw new Error(`catálogo: ${e.message}`);
      }
    },
    async enviarArquivo(caminho, arquivo) {
      const { error } = await supabase.storage
        .from("fotos")
        .upload(caminho, arquivo, { upsert: true, contentType: "image/webp" });
      if (error) throw new Error(`foto: ${error.message}`);
    },
    async userId() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw new Error("Sem sessão: entre de novo para sincronizar.");
      return data.user.id;
    },
  };
}
