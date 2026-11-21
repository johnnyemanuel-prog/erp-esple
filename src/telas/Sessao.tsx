"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { banco } from "@/lib/offline/db";
import { fecharSessao } from "@/lib/offline/repositorio";
import { pedirSincronizacao } from "@/lib/app/sync";
import { FotoPrincipal } from "@/componentes/Foto";
import { useModo } from "@/componentes/useModo";

export default function Sessao() {
  const id = useSearchParams().get("id") ?? "";
  const modo = useModo();
  const db = banco();
  const dados = useLiveQuery(async () => {
    const sessao = await db.sessoes.get(id);
    if (!sessao) return null;
    const local = await db.locais.get(sessao.localId);
    const movs = await db.movimentacoes.where("sessaoId").equals(id).toArray();
    movs.sort((a, b) => b.data.localeCompare(a.data));
    const modelos = new Map((await db.modelos.bulkGet([...new Set(movs.map((m) => m.modeloId))])).filter(Boolean).map((m) => [m!.id, m!]));
    return { sessao, local, movs, modelos };
  }, [id]);

  if (dados === undefined) return <p className="carregando">Carregando…</p>;
  if (dados === null) return <p className="aviso">Sessão não encontrada.</p>;
  const { sessao, local, movs, modelos } = dados;
  const pecas = movs.reduce((t, m) => t + m.quantidade, 0);

  return (
    <div>
      <h1>{sessao.nome}</h1>
      <p className="sub">{local?.nome} · {movs.length} montinhos · {pecas} peças · {sessao.fim ? "fechada" : "aberta"}</p>

      {!sessao.fim && modo === "campo" && (
        <Link className="botao grande" href={`/cadastro?sessao=${sessao.id}`}>+ Montinho</Link>
      )}

      <ul className="lista">
        {movs.map((m) => {
          const mod = modelos.get(m.modeloId);
          return (
            <li key={m.id}>
              <Link href={`/modelo?id=${m.modeloId}`} className="linha-modelo">
                <FotoPrincipal modeloId={m.modeloId} />
                <div>
                  <strong>{mod?.codigo} · {mod?.nome || "sem nome"}</strong>
                  <span>{m.quantidade} {m.quantidade === 1 ? "peça" : "peças"}{mod?.status === "rascunho" ? " · rascunho" : ""}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="acoes">
        {!sessao.fim && (
          <button
            className="botao secundario"
            onClick={async () => {
              if (!confirm("Fechar esta sessão? As etiquetas dela ficam prontas para imprimir.")) return;
              await fecharSessao(db, sessao.id);
              pedirSincronizacao();
            }}
          >
            Fechar sessão
          </button>
        )}
        <Link className="botao secundario" href={`/etiquetas?sessao=${sessao.id}`}>Etiquetas desta sessão</Link>
      </div>
    </div>
  );
}
