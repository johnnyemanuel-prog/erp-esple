"use client";
/**
 * Orquestra a sincronização no navegador: sobe a fila quando há internet (ao abrir, ao voltar
 * a conexão, logo depois de cada cadastro e de minuto em minuto) e baixa do servidor quando faz sentido.
 */
import { useSyncExternalStore } from "react";
import { banco } from "@/lib/offline/db";
import { baixar, remotoLeituraSupabase } from "@/lib/offline/baixar";
import { remotoSupabase, sincronizar } from "@/lib/offline/sincronizar";
import { modoAtual } from "./modo";
import { supabase } from "./supabase";

export interface StatusSync {
  online: boolean;
  sincronizando: boolean;
  ultimaVez: string | null;
  erro: string | null;
}

let status: StatusSync = { online: true, sincronizando: false, ultimaVez: null, erro: null };
const ouvintes = new Set<() => void>();
function definir(p: Partial<StatusSync>) {
  status = { ...status, ...p };
  ouvintes.forEach((f) => f());
}

export function useStatusSync(): StatusSync {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => status,
    () => status,
  );
}

const SEIS_HORAS = 6 * 60 * 60 * 1000;

/** Sobe a fila e, se pedido (ou no PC, ou com o aparelho vazio), baixa tudo do servidor. */
export async function sincronizarAgora(opcoes: { baixarTudo?: boolean } = {}) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    definir({ online: false });
    return;
  }
  const { data } = await supabase().auth.getSession();
  if (!data.session) return;
  definir({ sincronizando: true, online: true });
  try {
    const db = banco();
    const r = await sincronizar(db, remotoSupabase(supabase()));
    const vazio = (await db.modelos.count()) === 0 && (await db.locais.count()) === 0;
    const baixadoEm = (await db.meta.get("baixadoEm"))?.valor as string | undefined;
    const velho = !baixadoEm || Date.now() - Date.parse(baixadoEm) > SEIS_HORAS;
    if (opcoes.baixarTudo || vazio || (modoAtual() === "escritorio" && velho)) {
      await baixar(db, remotoLeituraSupabase(supabase()));
    }
    const pendente = (await db.fila.toArray()).find((i) => i.ultimoErro);
    definir({
      ultimaVez: new Date().toISOString(),
      erro: r.falhas ? (pendente?.ultimoErro ?? "Algum item não subiu; tento de novo.") : null,
    });
  } catch (e) {
    definir({ erro: e instanceof Error ? e.message : String(e) });
  } finally {
    definir({ sincronizando: false });
  }
}

let agendado: ReturnType<typeof setTimeout> | null = null;
/** Chamado depois de cada escrita: espera um instante para juntar vários cadastros num envio. */
export function pedirSincronizacao() {
  if (agendado) clearTimeout(agendado);
  agendado = setTimeout(() => {
    agendado = null;
    void sincronizarAgora();
  }, 2000);
}

let iniciado = false;
export function iniciarSincronizacaoAutomatica() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  definir({ online: navigator.onLine });
  window.addEventListener("online", () => {
    definir({ online: true });
    void sincronizarAgora();
  });
  window.addEventListener("offline", () => definir({ online: false }));
  setInterval(() => void sincronizarAgora(), 60_000);
  void sincronizarAgora();
}
