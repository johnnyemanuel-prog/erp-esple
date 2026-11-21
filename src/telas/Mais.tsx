"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { lerExportacaoInnosystem, type ResultadoLeitura } from "@/lib/innosystem/importar";
import { banco } from "@/lib/offline/db";
import { importarCatalogo } from "@/lib/offline/catalogo";
import { criarLocal } from "@/lib/offline/repositorio";
import { definirModo } from "@/lib/app/modo";
import { baixarArquivo, gerarPlanilhaModelos } from "@/lib/app/planilha";
import { supabase } from "@/lib/app/supabase";
import { pedirSincronizacao, sincronizarAgora, useStatusSync } from "@/lib/app/sync";
import { useModo } from "@/componentes/useModo";

/** O Innosystem pode exportar em UTF-8 ou em Windows-1252; detecta pelo cabeçalho. */
async function lerTexto(arq: File): Promise<string> {
  const bytes = await arq.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(bytes) : utf8;
}

export default function Mais() {
  const db = banco();
  const router = useRouter();
  const modo = useModo();
  const status = useStatusSync();
  const [leitura, setLeitura] = useState<ResultadoLeitura | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [novoLocal, setNovoLocal] = useState("");
  const info = useLiveQuery(async () => ({
    catalogo: await db.catalogo.count(),
    importadoEm: (await db.meta.get("catalogoImportadoEm"))?.valor as string | undefined,
    locais: await db.locais.orderBy("nome").toArray(),
    fila: await db.fila.toArray(),
  }), []);

  async function escolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0];
    e.target.value = "";
    if (!arq) return;
    setLeitura(lerExportacaoInnosystem(await lerTexto(arq)));
  }

  async function confirmarImportacao() {
    if (!leitura?.itens.length) return;
    await importarCatalogo(db, leitura.itens);
    setMsg(`Catálogo importado: ${leitura.itens.length} itens.`);
    setLeitura(null);
    pedirSincronizacao();
  }

  async function sair() {
    const pend = await db.fila.count();
    if (pend && !confirm(`Ainda há ${pend} itens sem enviar. Se sair, eles continuam guardados neste aparelho e sobem quando você entrar de novo. Sair mesmo?`)) return;
    await supabase().auth.signOut();
    router.replace("/entrar");
  }

  const comErro = info?.fila.filter((i) => i.ultimoErro) ?? [];

  return (
    <div>
      <h1>Mais</h1>

      <section className="cartao">
        <h2>Sincronização</h2>
        <p className="sub">
          {info?.fila.length ? `${info.fila.length} itens esperando envio.` : "Nada esperando envio."}
          {status.ultimaVez && ` Última: ${new Date(status.ultimaVez).toLocaleString("pt-BR")}.`}
        </p>
        {comErro.slice(0, 3).map((i) => <p key={i.seq} className="aviso">{i.tabela}: {i.ultimoErro}</p>)}
        <div className="acoes">
          <button className="botao secundario" onClick={() => sincronizarAgora()}>Enviar agora</button>
          <button className="botao secundario" onClick={() => sincronizarAgora({ baixarTudo: true })}>Baixar tudo do servidor</button>
        </div>
      </section>

      <section className="cartao">
        <h2>Catálogo do Innosystem</h2>
        <p className="sub">
          {info?.catalogo ? `${info.catalogo} itens${info.importadoEm ? `, importado em ${new Date(info.importadoEm).toLocaleDateString("pt-BR")}` : ""}.` : "Ainda não importado."}
          {" "}Use a exportação “Tabela de Preço” (CSV). Ele serve só para consulta: não vira estoque.
        </p>
        <label className="botao secundario">
          Escolher arquivo CSV
          <input type="file" accept=".csv,text/csv" hidden onChange={escolherArquivo} />
        </label>
        {leitura && (
          <div>
            {leitura.avisos.slice(0, 5).map((a) => <p key={a} className="aviso">{a}</p>)}
            {leitura.itens.length > 0 && (
              <>
                <p>{leitura.itens.length} itens. Ex.: {leitura.itens.slice(0, 3).map((i) => i.nomeSugerido).join(", ")}.</p>
                <button className="botao" onClick={confirmarImportacao}>Importar (substitui o catálogo atual)</button>
              </>
            )}
          </div>
        )}
        {msg && <p className="sucesso">{msg}</p>}
      </section>

      <section className="cartao">
        <h2>Locais</h2>
        <ul className="lista compacta">{info?.locais.map((l) => <li key={l.id}>{l.nome}</li>)}</ul>
        {modo === "campo" && (
          <form className="linha-form" onSubmit={async (e) => { e.preventDefault(); if (!novoLocal.trim()) return; await criarLocal(db, novoLocal); setNovoLocal(""); pedirSincronizacao(); }}>
            <input value={novoLocal} onChange={(e) => setNovoLocal(e.target.value)} placeholder="Maleta 2" />
            <button className="botao pequeno">Adicionar</button>
          </form>
        )}
      </section>

      <section className="cartao">
        <h2>Planilha</h2>
        <button className="botao secundario" onClick={async () => baixarArquivo(await gerarPlanilhaModelos(db), `esplendida-modelos-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8")}>
          Exportar modelos e estoque (CSV)
        </button>
        {modo === "campo" && <p className="sub"><Link href="/etiquetas">Etiquetas</Link> também podem ser geradas aqui e enviadas para o PC.</p>}
      </section>

      <section className="cartao">
        <h2>Este aparelho</h2>
        <div className="chips">
          <button className={modo === "campo" ? "chip ativo" : "chip"} onClick={() => definirModo("campo")}>Celular (cadastra)</button>
          <button className={modo === "escritorio" ? "chip ativo" : "chip"} onClick={() => definirModo("escritorio")}>Escritório (só lê e imprime)</button>
        </div>
        <p className="sub">Só um aparelho deve cadastrar, para os códigos não se repetirem.</p>
      </section>

      <section className="cartao">
        <h2>Conta</h2>
        <div className="acoes">
          <Link className="botao secundario" href="/nova-senha">Trocar senha</Link>
          <button className="botao link" onClick={sair}>Sair</button>
        </div>
      </section>
    </div>
  );
}
