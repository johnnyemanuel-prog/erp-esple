/**
 * Baixa do Supabase para o banco local. Usado pelo PC (modo escritório, que só lê)
 * e pelo celular quando o app é reinstalado ou o aparelho é trocado.
 *
 * Nunca sobrescreve um registro que ainda está na fila para subir: o do aparelho é mais novo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizar } from "@/lib/dominio/deducao";
import type { ItemCatalogo } from "@/lib/innosystem/importar";
import type { BancoEsplendida, TabelaSincronizada } from "./db";
import { tabelaLocal } from "./repositorio";

export interface RemotoLeitura {
  /** Todas as linhas da tabela (o remoto pagina por conta própria). */
  listar(tabela: TabelaSincronizada | "catalogo_innosystem"): Promise<Record<string, unknown>[]>;
}

const TABELAS: TabelaSincronizada[] = ["local", "fornecedora", "sessao_contagem", "modelo", "foto_modelo", "movimentacao"];

/** Campos do servidor que não existem no aparelho. */
const SO_NO_SERVIDOR = new Set(["user_id", "criado_em"]);

/** snake_case → camelCase. `criado_em` do modelo é mantido (o aparelho usa). */
export function paraRegistroLocal(tabela: TabelaSincronizada, linha: Record<string, unknown>) {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(linha)) {
    if (SO_NO_SERVIDOR.has(k) && !(tabela === "modelo" && k === "criado_em")) continue;
    r[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
  }
  return r;
}

export function paraItemCatalogo(l: Record<string, unknown>): ItemCatalogo {
  const s = (k: string) => (l[k] == null ? null : String(l[k]));
  const nome = s("nome") ?? "";
  const nomeSugerido = s("nome_sugerido") ?? nome;
  return {
    codigoInnosystem: String(l.codigo_innosystem),
    codigoBarras: s("codigo_barras"),
    nome,
    nomeSugerido,
    referencia: s("referencia"),
    referenciaNormalizada: s("referencia_normalizada"),
    categoria: s("categoria"),
    grupoOriginal: s("grupo_original"),
    custoCentavos: (l.custo_centavos as number | null) ?? null,
    precoCentavos: (l.preco_centavos as number | null) ?? null,
    fornecedora: s("fornecedora"),
    cor: s("cor"),
    ncm: s("ncm"),
    incluidoEm: s("incluido_em"),
    nomeBusca: `${normalizar(nome)} | ${normalizar(nomeSugerido)}`,
    dados: (l.dados as Record<string, string>) ?? {},
  };
}

export interface ResultadoBaixa {
  registros: number;
  catalogo: number;
}

export async function baixar(db: BancoEsplendida, remoto: RemotoLeitura): Promise<ResultadoBaixa> {
  let registros = 0;
  for (const tabela of TABELAS) {
    const linhas = await remoto.listar(tabela);
    const pendentes = new Set(
      (await db.fila.filter((i) => i.tabela === tabela).toArray()).map((i) => i.registroId),
    );
    const t = tabelaLocal(db, tabela);
    const novos: Record<string, unknown>[] = [];
    for (const linha of linhas) {
      const reg = paraRegistroLocal(tabela, linha) as { id: string } & Record<string, unknown>;
      if (pendentes.has(reg.id)) continue;
      if (tabela === "foto_modelo") {
        // Mantém a imagem que já está no aparelho.
        const atual = (await t.get(reg.id)) as Record<string, unknown> | undefined;
        if (atual) Object.assign(reg, { imagem: atual.imagem, miniatura: atual.miniatura });
      }
      novos.push(reg);
    }
    await t.bulkPut(novos as { id: string }[]);
    registros += novos.length;
  }

  // Catálogo: só se não houver uma importação local esperando para subir.
  let catalogo = 0;
  if ((await db.meta.get("catalogoPendente"))?.valor !== true) {
    const linhas = await remoto.listar("catalogo_innosystem");
    if (linhas.length) {
      await db.transaction("rw", db.catalogo, async () => {
        await db.catalogo.clear();
        await db.catalogo.bulkPut(linhas.map(paraItemCatalogo));
      });
      catalogo = linhas.length;
    }
  }

  // O contador de códigos nunca fica abaixo do maior código já existente.
  const maior = await db.modelos.orderBy("codigo").last();
  const meta = await db.meta.get("ultimoCodigo");
  if (maior && Number(maior.codigo) > Number(meta?.valor ?? 0)) {
    await db.meta.put({ chave: "ultimoCodigo", valor: Number(maior.codigo) });
  }
  await db.meta.put({ chave: "baixadoEm", valor: new Date().toISOString() });
  return { registros, catalogo };
}

export function remotoLeituraSupabase(supabase: SupabaseClient): RemotoLeitura {
  return {
    async listar(tabela) {
      const todas: Record<string, unknown>[] = [];
      for (let de = 0; ; de += 1000) {
        const { data, error } = await supabase
          .from(tabela)
          .select("*")
          .order("id")
          .range(de, de + 999);
        if (error) throw new Error(`${tabela}: ${error.message}`);
        todas.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return todas;
    },
  };
}
