"use client";
/** Ponte com o worker da busca por foto, e a indexação das fotos em segundo plano. */
import { useSyncExternalStore } from "react";
import { banco } from "@/lib/offline/db";
import { indexarFotosPendentes } from "@/lib/offline/indexar";
import type { FotoModelo } from "@/lib/offline/db";
import { supabase } from "@/lib/app/supabase";
import { pedirSincronizacao } from "@/lib/app/sync";

export type EstadoVisao = "parado" | "carregando" | "pronto" | "erro";
let estado: EstadoVisao = "parado";
let erro: string | null = null;
const ouvintes = new Set<() => void>();
const definir = (e: EstadoVisao, msg: string | null = null) => {
  estado = e;
  erro = msg;
  ouvintes.forEach((f) => f());
};
export function useEstadoVisao() {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => estado,
    () => "parado" as EstadoVisao,
  );
}
export const erroVisao = () => erro;

let worker: Worker | null = null;
let seq = 0;
const pendentes = new Map<number, { ok: (v: unknown) => void; falha: (e: Error) => void }>();

function obterWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./visao.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e: MessageEvent<{ id: number; vetor?: number[]; ok?: boolean; erro?: string }>) => {
    const p = pendentes.get(e.data.id);
    if (!p) return;
    pendentes.delete(e.data.id);
    if (e.data.erro) {
      definir("erro", e.data.erro);
      p.falha(new Error(e.data.erro));
    } else {
      definir("pronto");
      p.ok(e.data.vetor ?? true);
    }
  };
  return worker;
}

function pedir<T>(msg: { tipo: "carregar" | "vetor"; imagem?: Blob }): Promise<T> {
  if (estado !== "pronto") definir("carregando");
  const id = ++seq;
  return new Promise<T>((ok, falha) => {
    pendentes.set(id, { ok: ok as (v: unknown) => void, falha });
    obterWorker().postMessage({ id, ...msg });
  });
}

export const visaoSuportada = () => typeof window !== "undefined" && typeof Worker !== "undefined" && typeof WebAssembly !== "undefined";

/** Vetor da imagem (normalizado). Na primeira vez, carrega o modelo (~50 MB, depois fica no aparelho). */
export function vetorDaImagem(imagem: Blob): Promise<number[]> {
  return pedir<number[]>({ tipo: "vetor", imagem });
}

export function prepararVisao(): Promise<void> {
  return pedir<void>({ tipo: "carregar" });
}

/** Imagem da foto: a do aparelho ou, se veio do servidor, baixada do armazenamento. */
async function obterImagem(f: FotoModelo): Promise<Blob | null> {
  if (f.imagem ?? f.miniatura) return (f.imagem ?? f.miniatura)!;
  const caminho = f.caminho ?? f.caminhoMiniatura;
  if (!caminho || !navigator.onLine) return null;
  const { data, error } = await supabase().storage.from("fotos").download(caminho);
  return error ? null : data;
}

let indexando = false;
let agendado: ReturnType<typeof setTimeout> | null = null;

/** Calcula, sem pressa, o vetor das fotos que ainda não têm (para a busca por foto e o aviso de duplicata). */
export function pedirIndexacao(atrasoMs = 3000) {
  if (!visaoSuportada()) return;
  if (agendado) clearTimeout(agendado);
  agendado = setTimeout(async () => {
    agendado = null;
    if (indexando) return;
    indexando = true;
    try {
      const feitas = await indexarFotosPendentes(banco(), vetorDaImagem, obterImagem);
      if (feitas) pedirSincronizacao();
    } catch (e) {
      // Sem conseguir carregar o modelo agora (ex.: offline na primeira vez): tenta depois.
      console.warn("Indexação de fotos adiada:", e);
    } finally {
      indexando = false;
    }
  }, atrasoMs);
}
