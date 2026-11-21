"use client";
import { useSyncExternalStore } from "react";
import { modoAtual, type Modo } from "@/lib/app/modo";

export function useModo(): Modo {
  return useSyncExternalStore(
    (f) => {
      window.addEventListener("esplendida-modo", f);
      return () => window.removeEventListener("esplendida-modo", f);
    },
    modoAtual,
    () => "campo",
  );
}
