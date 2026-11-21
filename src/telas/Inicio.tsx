"use client";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { banco } from "@/lib/offline/db";
import { useModo } from "@/componentes/useModo";

export default function Inicio() {
  const modo = useModo();
  const dados = useLiveQuery(async () => {
    const db = banco();
    const [modelos, rascunhos, movs, abertas] = await Promise.all([
      db.modelos.count(),
      db.modelos.where("status").equals("rascunho").count(),
      db.movimentacoes.toArray(),
      db.sessoes.filter((s) => !s.fim).toArray(),
    ]);
    const pecas = movs.reduce((t, m) => t + (m.localDestinoId ? m.quantidade : 0) - (m.localOrigemId ? m.quantidade : 0), 0);
    const catalogo = await db.catalogo.count();
    return { modelos, rascunhos, pecas, abertas, catalogo };
  }, []);

  return (
    <div className="inicio">
      <h1>Esplêndida</h1>
      <div className="numeros">
        <div><strong>{dados?.modelos ?? "…"}</strong><span>modelos</span></div>
        <div><strong>{dados?.pecas ?? "…"}</strong><span>peças</span></div>
        <div><strong>{dados?.rascunhos ?? "…"}</strong><span>pendentes</span></div>
      </div>

      {modo === "campo" && dados?.abertas.map((s) => (
        <Link key={s.id} href={`/sessao?id=${s.id}`} className="cartao destaque">
          Continuar contagem: <strong>{s.nome}</strong>
        </Link>
      ))}

      <div className="acoes">
        {modo === "campo" && <Link className="botao grande" href="/sessoes">Contar uma gaveta</Link>}
        <Link className="botao grande secundario" href="/consulta">Consultar peça</Link>
        {modo === "escritorio" && <Link className="botao grande" href="/etiquetas">Imprimir etiquetas</Link>}
        <Link className="botao grande secundario" href="/pendencias">Pendências ({dados?.rascunhos ?? 0})</Link>
      </div>

      {dados && dados.catalogo === 0 && (
        <p className="aviso">
          O catálogo do Innosystem ainda não está neste aparelho. Importe em <Link href="/mais">Mais</Link> para a leitura das etiquetas antigas funcionar.
        </p>
      )}
    </div>
  );
}
