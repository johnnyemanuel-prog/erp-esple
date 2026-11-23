"use client";
/** Mostra a foto do aparelho (offline) ou, no PC, a do servidor por um link temporário. */
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { banco, type FotoModelo } from "@/lib/offline/db";
import { supabase } from "@/lib/app/supabase";

export function useUrlFoto(foto: FotoModelo | undefined, tamanho: "mini" | "grande") {
  const blob = foto ? (tamanho === "mini" ? (foto.miniatura ?? foto.imagem) : (foto.imagem ?? foto.miniatura)) : null;
  const caminho = foto && !blob
    ? (tamanho === "mini" ? (foto.caminhoMiniatura ?? foto.caminho) : (foto.caminho ?? foto.caminhoMiniatura))
    : null;
  const urlLocal = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => { if (urlLocal) URL.revokeObjectURL(urlLocal); }, [urlLocal]);

  const [remota, setRemota] = useState<{ caminho: string; url: string } | null>(null);
  useEffect(() => {
    if (!caminho) return;
    let vivo = true;
    supabase()
      .storage.from("fotos")
      .createSignedUrl(caminho, 3600)
      .then(({ data }) => { if (vivo && data?.signedUrl) setRemota({ caminho, url: data.signedUrl }); });
    return () => { vivo = false; };
  }, [caminho]);

  return urlLocal ?? (remota && remota.caminho === caminho ? remota.url : null);
}

export function FotoPrincipal({ modeloId, tamanho = "mini", className }: { modeloId: string; tamanho?: "mini" | "grande"; className?: string }) {
  const foto = useLiveQuery(
    async () => (await banco().fotos.where("modeloId").equals(modeloId).sortBy("ordem"))[0],
    [modeloId],
  );
  const url = useUrlFoto(foto, tamanho);
  // Tem foto, mas ainda está chegando do servidor: espaço vazio em vez de "sem foto".
  if (!url && foto) return <div className={`${className ?? (tamanho === "mini" ? "mini" : "foto-grande")} sem-foto`} aria-busy="true" />;
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={className ?? (tamanho === "mini" ? "mini" : "foto-grande")} />
  ) : (
    <div className={`${className ?? (tamanho === "mini" ? "mini" : "foto-grande")} sem-foto`}>sem foto</div>
  );
}

export function Foto({ foto, className }: { foto: FotoModelo; className?: string }) {
  const url = useUrlFoto(foto, "grande");
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" className={className} /> : <div className={`${className} sem-foto`}>…</div>;
}
