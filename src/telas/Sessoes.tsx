"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { banco } from "@/lib/offline/db";
import { abrirSessao, criarLocal } from "@/lib/offline/repositorio";
import { pedirSincronizacao } from "@/lib/app/sync";

export default function Sessoes() {
  const router = useRouter();
  const db = banco();
  const locais = useLiveQuery(() => db.locais.orderBy("nome").filter((l) => l.ativo).toArray(), [], []);
  const sessoes = useLiveQuery(() => db.sessoes.orderBy("inicio").reverse().toArray(), [], []);
  const [nome, setNome] = useState("");
  const [localId, setLocalId] = useState("");
  const [novoLocal, setNovoLocal] = useState("");

  const nomeLocal = (id: string) => locais.find((l) => l.id === id)?.nome ?? "";

  async function abrir(e: React.FormEvent) {
    e.preventDefault();
    let id = localId || locais[0]?.id;
    if (novoLocal.trim()) id = (await criarLocal(db, novoLocal)).id;
    if (!id || !nome.trim()) return;
    const s = await abrirSessao(db, nome, id);
    pedirSincronizacao();
    router.push(`/sessao?id=${s.id}`);
  }

  return (
    <div>
      <h1>Contagem</h1>
      <form className="cartao" onSubmit={abrir}>
        <h2>Nova sessão</h2>
        <label className="campo">
          <span>O que vai contar</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Gaveta 2 do quarto" required />
        </label>
        {locais.length > 0 && !novoLocal && (
          <label className="campo">
            <span>Onde as peças ficam guardadas</span>
            <select value={localId || locais[0]?.id} onChange={(e) => setLocalId(e.target.value)}>
              {locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </label>
        )}
        <label className="campo">
          <span>{locais.length ? "Ou um local novo" : "Local (ex.: Casa, Maleta 1)"}</span>
          <input value={novoLocal} onChange={(e) => setNovoLocal(e.target.value)} placeholder={locais.length ? "" : "Casa"} required={!locais.length} />
        </label>
        <button className="botao">Abrir sessão</button>
      </form>

      <h2>Sessões</h2>
      {sessoes.length === 0 && <p className="vazio">Nenhuma sessão ainda.</p>}
      <ul className="lista">
        {sessoes.map((s) => (
          <li key={s.id}>
            <Link href={`/sessao?id=${s.id}`}>
              <strong>{s.nome}</strong>
              <span>{nomeLocal(s.localId)} · {new Date(s.inicio).toLocaleDateString("pt-BR")} · {s.fim ? "fechada" : "aberta"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
