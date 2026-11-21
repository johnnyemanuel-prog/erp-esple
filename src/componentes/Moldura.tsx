"use client";
/**
 * Moldura de todas as telas: exige login, mostra o estado da sincronização e a navegação de baixo.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { banco } from "@/lib/offline/db";
import { iniciarSincronizacaoAutomatica, sincronizarAgora, useStatusSync } from "@/lib/app/sync";
import { supabase } from "@/lib/app/supabase";
import { useModo } from "./useModo";

const LIVRES = ["/entrar", "/nova-senha"];

export function Moldura({ children }: { children: ReactNode }) {
  const caminho = usePathname();
  const router = useRouter();
  const livre = LIVRES.includes(caminho);
  const [logado, setLogado] = useState<boolean | null>(null);

  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => setLogado(!!data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setLogado(!!s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (logado === false && !livre) router.replace("/entrar");
    if (logado) iniciarSincronizacaoAutomatica();
  }, [logado, livre, router]);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register(`/sw.js?v=${process.env.NEXT_PUBLIC_VERSAO ?? "dev"}`).catch(() => {});
    }
  }, []);

  if (livre) return <main className="tela">{children}</main>;
  if (!logado) return <main className="tela carregando">Carregando…</main>;

  return (
    <>
      <BarraSync />
      <main className="tela">{children}</main>
      <Navegacao caminho={caminho} />
    </>
  );
}

function BarraSync() {
  const s = useStatusSync();
  const pendentes = useLiveQuery(() => banco().fila.count(), [], 0);
  let texto = "Tudo salvo na nuvem";
  let classe = "ok";
  if (!s.online) {
    texto = pendentes ? `Sem internet · ${pendentes} para enviar` : "Sem internet · tudo guardado no aparelho";
    classe = "offline";
  } else if (s.sincronizando) {
    texto = "Sincronizando…";
    classe = "andando";
  } else if (s.erro) {
    texto = `Não sincronizou: ${s.erro}`;
    classe = "erro";
  } else if (pendentes) {
    texto = `${pendentes} para enviar`;
    classe = "andando";
  }
  return (
    <button className={`barra-sync ${classe}`} onClick={() => void sincronizarAgora()} title="Sincronizar agora">
      {texto}
    </button>
  );
}

function Navegacao({ caminho }: { caminho: string }) {
  const modo = useModo();
  const pendencias = useLiveQuery(() => banco().modelos.where("status").equals("rascunho").count(), [], 0);
  const itens =
    modo === "campo"
      ? [
          { href: "/", rotulo: "Início" },
          { href: "/sessoes", rotulo: "Contar" },
          { href: "/consulta", rotulo: "Consultar" },
          { href: "/pendencias", rotulo: "Pendências", selo: pendencias },
          { href: "/mais", rotulo: "Mais" },
        ]
      : [
          { href: "/", rotulo: "Início" },
          { href: "/consulta", rotulo: "Consultar" },
          { href: "/etiquetas", rotulo: "Etiquetas" },
          { href: "/pendencias", rotulo: "Pendências", selo: pendencias },
          { href: "/mais", rotulo: "Mais" },
        ];
  return (
    <nav className="navegacao">
      {itens.map((i) => {
        const ativo = i.href === "/" ? caminho === "/" : caminho.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={ativo ? "ativo" : ""}>
            {i.rotulo}
            {i.selo ? <span className="selo">{i.selo}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
