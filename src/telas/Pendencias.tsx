"use client";
/** Fila de pendências: o que falta em cada rascunho, com preenchimento em lote por tipo. */
import Link from "next/link";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ROTULO_PENDENCIA, type Pendencia } from "@/lib/dominio/pendencias";
import { precoTabela } from "@/lib/dominio/preco";
import { banco, type Modelo } from "@/lib/offline/db";
import { atualizarModelo, listarPendencias } from "@/lib/offline/repositorio";
import { pedirSincronizacao } from "@/lib/app/sync";
import { CampoReais, Preco } from "@/componentes/Campos";
import { FotoPrincipal } from "@/componentes/Foto";
import { useModo } from "@/componentes/useModo";

const FILTROS: Pendencia[] = ["preco", "custo", "nome", "foto", "referencia", "foto_extra"];

export default function Pendencias() {
  const db = banco();
  const modo = useModo();
  const [filtro, setFiltro] = useState<Pendencia | null>(null);
  const todas = useLiveQuery(async () => {
    const lista = await listarPendencias(db);
    // Foto extra não bloqueia, mas aparece como pendência também para modelos completos.
    const completos = await db.modelos.where("status").equals("completo").toArray();
    for (const m of completos) {
      if ((await db.fotos.where("modeloId").equals(m.id).count()) < 2) lista.push({ modelo: m, faltando: ["foto_extra"] });
    }
    lista.sort((a, b) => a.modelo.codigo.localeCompare(b.modelo.codigo));
    return lista;
  }, []);

  if (!todas) return <p className="carregando">Carregando…</p>;
  const contagem = (p: Pendencia) => todas.filter((i) => i.faltando.includes(p)).length;
  const lista = filtro ? todas.filter((i) => i.faltando.includes(filtro)) : todas.filter((i) => !(i.faltando.length === 1 && i.faltando[0] === "foto_extra"));
  const emLote = filtro === "preco" || filtro === "custo" || filtro === "nome" || filtro === "referencia";

  return (
    <div>
      <h1>Pendências</h1>
      <div className="chips">
        <button className={!filtro ? "chip ativo" : "chip"} onClick={() => setFiltro(null)}>Rascunhos</button>
        {FILTROS.map((p) => (
          <button key={p} className={filtro === p ? "chip ativo" : "chip"} onClick={() => setFiltro(p)}>
            {ROTULO_PENDENCIA[p]} ({contagem(p)})
          </button>
        ))}
      </div>
      {lista.length === 0 && <p className="vazio">Nada pendente aqui.</p>}
      <ul className="lista">
        {lista.map(({ modelo, faltando }) => (
          <li key={modelo.id}>
            {emLote && modo === "campo" ? (
              <LinhaLote modelo={modelo} tipo={filtro!} />
            ) : (
              <Link href={`/modelo?id=${modelo.id}`} className="linha-modelo">
                <FotoPrincipal modeloId={modelo.id} />
                <div>
                  <strong>{modelo.codigo} · {modelo.nome || "sem nome"}</strong>
                  <span>Falta: {faltando.map((p) => ROTULO_PENDENCIA[p]).join(", ")}</span>
                </div>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Uma linha que se completa ali mesmo, sem abrir o modelo. */
function LinhaLote({ modelo, tipo }: { modelo: Modelo; tipo: Pendencia }) {
  const db = banco();
  const [custo, setCusto] = useState<number | null>(modelo.custoCentavos ?? null);
  const [texto, setTexto] = useState(tipo === "nome" ? (modelo.nome ?? "") : (modelo.referencia ?? ""));

  async function salvar() {
    if (tipo === "preco" || tipo === "custo") {
      if (!custo) return;
      await atualizarModelo(db, modelo.id, { custoCentavos: custo });
    } else if (tipo === "nome") {
      await atualizarModelo(db, modelo.id, { nome: texto.trim() || null });
    } else {
      await atualizarModelo(db, modelo.id, { referencia: texto.trim() || null });
    }
    pedirSincronizacao();
  }

  return (
    <div className="linha-lote">
      <Link href={`/modelo?id=${modelo.id}`} className="linha-modelo">
        <FotoPrincipal modeloId={modelo.id} />
        <div>
          <strong>{modelo.codigo} · {modelo.nome || "sem nome"}</strong>
          {modelo.precoProvisorioCentavos ? <span>Provisório: <Preco centavos={modelo.precoProvisorioCentavos} provisorio /></span> : null}
        </div>
      </Link>
      <div className="lote-campos">
        {tipo === "preco" || tipo === "custo" ? (
          <>
            <CampoReais rotulo="Custo" valor={custo} onChange={setCusto} />
            {custo ? <small>Tabela: <Preco centavos={precoTabela(custo)} /></small> : null}
          </>
        ) : (
          <label className="campo">
            <span>{tipo === "nome" ? "Nome" : "Referência"}</span>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} />
          </label>
        )}
        <button className="botao pequeno" onClick={salvar}>Salvar</button>
      </div>
    </div>
  );
}
