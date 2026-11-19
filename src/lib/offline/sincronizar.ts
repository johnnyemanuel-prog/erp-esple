/**
 * Envia a fila do celular para o Supabase. Idempotente: os ids são gerados no celular
 * e o envio é um upsert, então reenviar o mesmo item não duplica nada.
 *
 * O remoto é uma interface, para testar sem rede; `remotoSupabase` liga ao cliente real.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BancoEsplendida, FotoModelo, ItemFila, TabelaSincronizada } from "./db";
import { tabelaLocal } from "./repositorio";

export interface Remoto {
  upsert(tabela: TabelaSincronizada, linha: Record<string, unknown>): Promise<void>;
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
  return { enviados, falhas, restantes: await db.fila.count() };
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
