"use client";
/** Consulta por código, QR, etiqueta antiga ou nome. Funciona sem internet. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { precoAtual } from "@/lib/dominio/preco";
import { banco, type Modelo } from "@/lib/offline/db";
import { acharModeloPorLeitura, buscarModelosPorNome, buscarPorCodigoBarras } from "@/lib/offline/catalogo";
import { Preco } from "@/componentes/Campos";
import { FotoPrincipal } from "@/componentes/Foto";
import { Leitor, leitorDisponivel } from "@/componentes/Leitor";

export default function Consulta() {
  const router = useRouter();
  const db = banco();
  const [texto, setTexto] = useState("");
  const [lendo, setLendo] = useState(false);
  const [resultados, setResultados] = useState<Modelo[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const t = texto.trim();
    if (!t) return;
    let vivo = true;
    (async () => {
      const lista: Modelo[] = [];
      const exato = await acharModeloPorLeitura(db, t);
      if (exato) lista.push(exato);
      for (const m of await buscarModelosPorNome(db, t, 20)) if (!lista.some((x) => x.id === m.id)) lista.push(m);
      if (vivo) setResultados(lista);
    })();
    return () => {
      vivo = false;
    };
  }, [texto, db]);

  const aoLer = useCallback(async (lido: string) => {
    setLendo(false);
    const m = await acharModeloPorLeitura(db, lido);
    if (m) return router.push(`/modelo?id=${m.id}`);
    const item = await buscarPorCodigoBarras(db, lido);
    setTexto(lido);
    setAviso(item ? `“${item.nomeSugerido}” está no Innosystem, mas ainda não foi contado aqui.` : `Nada encontrado para ${lido}.`);
  }, [db, router]);

  return (
    <div>
      <h1>Consultar</h1>
      {lendo ? (
        <Leitor onLido={aoLer} onFechar={() => setLendo(false)} />
      ) : (
        <button className="botao grande" onClick={() => (leitorDisponivel() ? setLendo(true) : setAviso("Este navegador não lê códigos pela câmera. Digite."))}>
          Ler QR ou etiqueta
        </button>
      )}
      <label className="campo">
        <span>Código ou nome</span>
        <input value={texto} onChange={(e) => { setTexto(e.target.value); setAviso(null); }} placeholder="0123 ou brinco glow" autoComplete="off" />
      </label>
      {aviso && <p className="aviso">{aviso}</p>}
      <ul className="lista">
        {(texto.trim() ? resultados : []).map((m) => (
          <li key={m.id}>
            <Link href={`/modelo?id=${m.id}`} className="linha-modelo">
              <FotoPrincipal modeloId={m.id} />
              <div>
                <strong>{m.codigo} · {m.nome || "sem nome"}</strong>
                <span><Preco centavos={precoAtual(m).centavos} provisorio={precoAtual(m).origem === "provisorio"} /></span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
