"use client";
/** Ficha do modelo: foto em destaque (para conferir), preço atual, estoque por local, "vendi 1" e edição. */
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BANHOS_PADRAO, CATEGORIAS_PADRAO } from "@/lib/dominio/deducao";
import { precoDisfarcado } from "@/lib/dominio/etiqueta";
import { ROTULO_PENDENCIA, pendencias } from "@/lib/dominio/pendencias";
import { precoAtual } from "@/lib/dominio/preco";
import { banco, type Modelo as TModelo } from "@/lib/offline/db";
import { atualizarModelo, saldoPorLocal, salvarFoto, vendi1 } from "@/lib/offline/repositorio";
import { comprimirFoto } from "@/lib/app/foto";
import { pedirSincronizacao } from "@/lib/app/sync";
import { CampoReais, Chips, Preco } from "@/componentes/Campos";
import { Foto } from "@/componentes/Foto";
import { useModo } from "@/componentes/useModo";

const TIPO = { entrada: "Entrada", venda: "Venda", transferencia: "Transferência", ajuste: "Ajuste" } as const;

export default function Modelo() {
  const id = useSearchParams().get("id") ?? "";
  const db = banco();
  const modo = useModo();
  const [editando, setEditando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  const dados = useLiveQuery(async () => {
    const modelo = await db.modelos.get(id);
    if (!modelo) return null;
    const [fotos, saldo, locais, movs] = await Promise.all([
      db.fotos.where("modeloId").equals(id).sortBy("ordem"),
      saldoPorLocal(db, id),
      db.locais.toArray(),
      db.movimentacoes.where("modeloId").equals(id).toArray(),
    ]);
    movs.sort((a, b) => b.data.localeCompare(a.data));
    return { modelo, fotos, saldo, locais, movs };
  }, [id]);

  if (dados === undefined) return <p className="carregando">Carregando…</p>;
  if (dados === null) return <p className="aviso">Modelo não encontrado.</p>;
  const { modelo, fotos, saldo, locais, movs } = dados;
  const p = precoAtual(modelo);
  const faltando = pendencias({ ...modelo, qtdFotos: fotos.length });
  const nomeLocal = (lid?: string | null) => locais.find((l) => l.id === lid)?.nome ?? "";
  const comEstoque = locais.filter((l) => (saldo.get(l.id) ?? 0) > 0);
  const total = [...saldo.values()].reduce((a, b) => a + b, 0);

  async function vender(localId: string) {
    await vendi1(db, modelo.id, localId);
    pedirSincronizacao();
    setMsg(`Baixa de 1 em ${nomeLocal(localId)}.`);
  }

  async function novaFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0];
    e.target.value = "";
    if (!arq) return;
    const c = await comprimirFoto(arq);
    await salvarFoto(db, { modeloId: modelo.id, ...c });
    pedirSincronizacao();
  }

  return (
    <div className="modelo">
      <div className="galeria">
        {fotos.length ? fotos.map((f) => <Foto key={f.id} foto={f} className="foto-grande" />) : <div className="foto-grande sem-foto">sem foto</div>}
      </div>
      <h1><span className="codigo">{modelo.codigo}</span> {modelo.nome || "sem nome"}</h1>
      <p className="preco-grande"><Preco centavos={p.centavos} provisorio={p.origem === "provisorio"} /></p>
      <p className="sub">
        Etiqueta: <code>{modelo.codigo} {precoDisfarcado(p.centavos)}</code>
        {modelo.etiquetaImpressaEm && modelo.precoImpressoCentavos !== p.centavos && (
          <strong className="alerta"> · reimprimir (a colada diz {precoDisfarcado(modelo.precoImpressoCentavos)})</strong>
        )}
        {!modelo.etiquetaImpressaEm && " · ainda não impressa"}
      </p>
      {faltando.length > 0 && <p className="aviso">Falta: {faltando.map((f) => ROTULO_PENDENCIA[f]).join(", ")}</p>}
      {msg && <p className="sucesso">{msg}</p>}

      <h2>Estoque: {total}</h2>
      <ul className="lista compacta">
        {locais.filter((l) => saldo.has(l.id)).map((l) => (
          <li key={l.id} className="linha-estoque">
            <span>{l.nome}: <strong>{saldo.get(l.id)}</strong></span>
            {modo === "campo" && (saldo.get(l.id) ?? 0) > 0 && (
              <button className="botao pequeno" onClick={() => vender(l.id)}>Vendi 1</button>
            )}
          </li>
        ))}
      </ul>
      {modo === "campo" && comEstoque.length === 0 && total <= 0 && <p className="sub">Sem estoque registrado.</p>}

      <dl className="ficha">
        <dt>Categoria</dt><dd>{modelo.categoria ?? "—"}</dd>
        <dt>Banho</dt><dd>{modelo.banho ?? "—"}</dd>
        <dt>Referência</dt><dd>{modelo.referencia ?? "—"}</dd>
        <dt>Custo</dt><dd>{modelo.custoCentavos ? <Preco centavos={modelo.custoCentavos} /> : "—"}</dd>
        {modelo.arosDisponiveis && (<><dt>Aros</dt><dd>{modelo.arosDisponiveis}</dd></>)}
        {modelo.codigoBarrasInnosystem && (<><dt>Cód. Innosystem</dt><dd>{modelo.codigoBarrasInnosystem}</dd></>)}
      </dl>

      {modo === "campo" && (
        <div className="acoes">
          <button className="botao secundario" onClick={() => inputFoto.current?.click()}>Adicionar foto</button>
          <button className="botao secundario" onClick={() => setEditando((e) => !e)}>{editando ? "Fechar edição" : "Editar"}</button>
          <input ref={inputFoto} type="file" accept="image/*" capture="environment" hidden onChange={novaFoto} />
        </div>
      )}
      {editando && <Edicao modelo={modelo} onFim={() => setEditando(false)} />}

      <h2>Movimentações</h2>
      <ul className="lista compacta">
        {movs.map((m) => (
          <li key={m.id}>
            {new Date(m.data).toLocaleDateString("pt-BR")} · {TIPO[m.tipo]} · {m.quantidade}
            {m.localOrigemId && ` · de ${nomeLocal(m.localOrigemId)}`}
            {m.localDestinoId && ` · em ${nomeLocal(m.localDestinoId)}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Edicao({ modelo, onFim }: { modelo: TModelo; onFim: () => void }) {
  const db = banco();
  const [e, setE] = useState({
    nome: modelo.nome ?? "",
    referencia: modelo.referencia ?? "",
    categoria: modelo.categoria ?? null,
    banho: modelo.banho ?? null,
    aros: modelo.arosDisponiveis ?? "",
    custo: modelo.custoCentavos ?? null,
    precoProvisorio: modelo.precoProvisorioCentavos ?? null,
  });
  async function salvar() {
    await atualizarModelo(db, modelo.id, {
      nome: e.nome.trim() || null,
      referencia: e.referencia.trim() || null,
      categoria: e.categoria,
      banho: e.banho,
      arosDisponiveis: e.aros.trim() || null,
      custoCentavos: e.custo,
      precoProvisorioCentavos: e.precoProvisorio,
    });
    pedirSincronizacao();
    onFim();
  }
  return (
    <div className="cartao">
      <label className="campo"><span>Nome</span><input value={e.nome} onChange={(x) => setE({ ...e, nome: x.target.value })} /></label>
      <label className="campo"><span>Referência</span><input value={e.referencia} onChange={(x) => setE({ ...e, referencia: x.target.value })} /></label>
      <div className="campo"><span>Categoria</span><Chips opcoes={CATEGORIAS_PADRAO.map((c) => c.nome)} valor={e.categoria} onChange={(categoria) => setE({ ...e, categoria })} /></div>
      <div className="campo"><span>Banho</span><Chips opcoes={BANHOS_PADRAO.map((b) => b.nome)} valor={e.banho} onChange={(banho) => setE({ ...e, banho })} /></div>
      <label className="campo"><span>Aros disponíveis</span><input value={e.aros} onChange={(x) => setE({ ...e, aros: x.target.value })} /></label>
      <CampoReais rotulo="Custo" valor={e.custo} onChange={(custo) => setE({ ...e, custo })} />
      <CampoReais rotulo="Preço provisório (só vale sem custo)" valor={e.precoProvisorio} onChange={(precoProvisorio) => setE({ ...e, precoProvisorio })} />
      <button className="botao" onClick={salvar}>Salvar</button>
    </div>
  );
}
