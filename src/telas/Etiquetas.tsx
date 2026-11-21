"use client";
/**
 * Etiquetas: escolhe o que imprimir, gera o PDF A4 (imprimir em 100%, "tamanho real")
 * e, depois de conferir a folha, marca como impressas.
 */
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { precoDisfarcado } from "@/lib/dominio/etiqueta";
import { etiquetasPorFolha, FOLHA_A4349, validarFolha, type ModeloFolha } from "@/lib/dominio/folha";
import { precoAtual } from "@/lib/dominio/preco";
import { gerarPdfEtiquetas } from "@/lib/etiquetas/pdf";
import { banco, type Modelo } from "@/lib/offline/db";
import { listarAReimprimir, marcarEtiquetasImpressas } from "@/lib/offline/repositorio";
import { baixarArquivo } from "@/lib/app/planilha";
import { pedirSincronizacao } from "@/lib/app/sync";

type Fonte = "sessao" | "nunca" | "reimprimir" | "codigos";
const CHAVE_FOLHA = "esplendida.folha";

function lerFolha(): ModeloFolha {
  try {
    const s = localStorage.getItem(CHAVE_FOLHA);
    if (s) return { ...FOLHA_A4349, ...JSON.parse(s) };
  } catch {}
  return FOLHA_A4349;
}

export default function Etiquetas() {
  const db = banco();
  const params = useSearchParams();
  const [fonte, setFonte] = useState<Fonte>(params.get("sessao") ? "sessao" : "nunca");
  const [sessaoId, setSessaoId] = useState(params.get("sessao") ?? "");
  const [codigos, setCodigos] = useState("");
  const [folha, setFolha] = useState<ModeloFolha>(lerFolha);
  const [contorno, setContorno] = useState(false);
  const [gerado, setGerado] = useState<string[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const salvarFolha = (f: ModeloFolha) => {
    setFolha(f);
    try { localStorage.setItem(CHAVE_FOLHA, JSON.stringify(f)); } catch {}
  };

  const sessoes = useLiveQuery(() => db.sessoes.orderBy("inicio").reverse().toArray(), [], []);
  const modelos = useLiveQuery(async (): Promise<Modelo[]> => {
    if (fonte === "sessao") {
      if (!sessaoId) return [];
      const ids = [...new Set((await db.movimentacoes.where("sessaoId").equals(sessaoId).toArray()).map((m) => m.modeloId))];
      return (await db.modelos.bulkGet(ids)).filter((m): m is Modelo => !!m);
    }
    if (fonte === "nunca") return db.modelos.filter((m) => !m.etiquetaImpressaEm).toArray();
    if (fonte === "reimprimir") return listarAReimprimir(db);
    const lista = codigos.split(/[\s,;]+/).filter(Boolean).map((c) => c.padStart(4, "0"));
    return (await db.modelos.where("codigo").anyOf(lista).toArray());
  }, [fonte, sessaoId, codigos], []);

  const ordenados = useMemo(() => [...modelos].sort((a, b) => a.codigo.localeCompare(b.codigo)), [modelos]);
  const errosFolha = validarFolha(folha);
  const folhas = Math.ceil(ordenados.length / etiquetasPorFolha(folha));

  async function gerar(teste = false) {
    const lista = teste
      ? Array.from({ length: etiquetasPorFolha(folha) }, (_, i) => ({ codigo: String(i + 1).padStart(4, "0"), precoCentavos: 4790 }))
      : ordenados.map((m) => ({ codigo: m.codigo, precoCentavos: precoAtual(m).centavos }));
    const bytes = await gerarPdfEtiquetas(lista, folha, { contorno: teste || contorno });
    const nome = teste ? "teste-alinhamento.pdf" : `etiquetas-${new Date().toISOString().slice(0, 10)}.pdf`;
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    if (!window.open(url, "_blank")) baixarArquivo(bytes as BlobPart, nome, "application/pdf");
    if (!teste) setGerado(ordenados.map((m) => m.id));
  }

  async function marcar() {
    if (!gerado) return;
    await marcarEtiquetasImpressas(db, gerado);
    pedirSincronizacao();
    setMsg(`${gerado.length} etiquetas marcadas como impressas.`);
    setGerado(null);
  }

  const num = (k: keyof ModeloFolha, rotulo: string) => (
    <label className="campo curto">
      <span>{rotulo}</span>
      <input type="number" step="0.1" value={folha[k] as number} onChange={(e) => salvarFolha({ ...folha, [k]: Number(e.target.value) })} />
    </label>
  );

  return (
    <div>
      <h1>Etiquetas</h1>
      <div className="chips">
        {([["sessao", "Por sessão"], ["nunca", "Nunca impressas"], ["reimprimir", "A reimprimir"], ["codigos", "Códigos"]] as const).map(([v, r]) => (
          <button key={v} className={fonte === v ? "chip ativo" : "chip"} onClick={() => { setFonte(v); setGerado(null); }}>{r}</button>
        ))}
      </div>

      {fonte === "sessao" && (
        <label className="campo">
          <span>Sessão</span>
          <select value={sessaoId} onChange={(e) => setSessaoId(e.target.value)}>
            <option value="">Escolha…</option>
            {sessoes.map((s) => <option key={s.id} value={s.id}>{s.nome} ({new Date(s.inicio).toLocaleDateString("pt-BR")})</option>)}
          </select>
        </label>
      )}
      {fonte === "codigos" && (
        <label className="campo">
          <span>Códigos separados por espaço ou vírgula</span>
          <input value={codigos} onChange={(e) => setCodigos(e.target.value)} placeholder="12 45 0103" />
        </label>
      )}

      <p className="sub">{ordenados.length} etiquetas · {folhas} {folhas === 1 ? "folha" : "folhas"} · começa sempre na 1ª etiqueta da folha</p>
      <div className="previa-etiquetas">
        {ordenados.slice(0, 60).map((m) => (
          <span key={m.id} className={m.status === "rascunho" ? "et rascunho" : "et"}>{m.codigo} {precoDisfarcado(precoAtual(m).centavos)}</span>
        ))}
        {ordenados.length > 60 && <span className="et">+{ordenados.length - 60}</span>}
      </div>

      <div className="acoes">
        <button className="botao grande" disabled={!ordenados.length || errosFolha.length > 0} onClick={() => gerar()}>Gerar PDF</button>
      </div>
      {gerado && (
        <div className="cartao destaque">
          <p>Imprima em <strong>100% / tamanho real</strong>. A folha saiu certinha?</p>
          <button className="botao" onClick={marcar}>Sim, marcar {gerado.length} como impressas</button>
        </div>
      )}
      {msg && <p className="sucesso">{msg}</p>}

      <details className="cartao">
        <summary>Ajuste da folha ({folha.nome})</summary>
        <p className="sub">Imprima o teste em papel comum, sobreponha a uma folha de etiquetas contra a luz e ajuste. Positivo move para a direita / para baixo.</p>
        <div className="grade-campos">
          {num("ajusteXMm", "Ajuste X (mm)")}
          {num("ajusteYMm", "Ajuste Y (mm)")}
          {num("margemEsquerdaMm", "Margem esquerda")}
          {num("margemSuperiorMm", "Margem superior")}
          {num("espacoHorizontalMm", "Espaço entre colunas")}
          {num("espacoVerticalMm", "Espaço entre linhas")}
          {num("colunas", "Colunas")}
          {num("linhas", "Linhas")}
          {num("larguraEtiquetaMm", "Largura etiqueta")}
          {num("alturaEtiquetaMm", "Altura etiqueta")}
        </div>
        {errosFolha.map((e) => <p key={e} className="aviso">{e}</p>)}
        <label className="check"><input type="checkbox" checked={contorno} onChange={(e) => setContorno(e.target.checked)} /> Desenhar contorno nas etiquetas</label>
        <div className="acoes">
          <button className="botao secundario" onClick={() => gerar(true)} disabled={errosFolha.length > 0}>Imprimir folha de teste</button>
          <button className="botao link" onClick={() => salvarFolha(FOLHA_A4349)}>Voltar ao padrão A4349</button>
        </div>
      </details>
    </div>
  );
}
