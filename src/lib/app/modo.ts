"use client";
/**
 * Modo do aparelho. "campo" (celular) cadastra; "escritorio" (PC) só lê, imprime e exporta.
 * Só o celular gera códigos de modelo, então só um aparelho deve ficar no modo campo.
 */
export type Modo = "campo" | "escritorio";
const CHAVE = "esplendida.modo";

export function modoAtual(): Modo {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo === "campo" || salvo === "escritorio") return salvo;
  } catch {}
  if (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches) return "campo";
  return "escritorio";
}

export function definirModo(m: Modo) {
  try {
    localStorage.setItem(CHAVE, m);
  } catch {}
  window.dispatchEvent(new Event("esplendida-modo"));
}
