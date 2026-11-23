"use client";
/** Consulta por código, QR, etiqueta antiga ou nome. Funciona sem internet. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { precoAtual } from "@/lib/dominio/preco";
import { banco, type Modelo } from "@/lib/offline/db";
import { buscarModelosPorNome, lerCodigo } from "@/lib/offline/catalogo";
import { buscarPorVetor } from "@/lib/offline/indexar";
import { comprimirFoto } from "@/lib/app/foto";
import { pedirIndexacao, vetorDaImagem, visaoSuportada } from "@/lib/ia/visao";
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
  const [porFoto, setPorFoto] = useState<{ previa: string; analisando: boolean; candidatos: { modelo: Modelo; similaridade: number }[] } | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  async function buscarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0];
    e.target.value = "";
    if (!arq) return;
    setAviso(null);
    try {
      const { imagem, miniatura } = await comprimirFoto(arq);
      if (porFoto) URL.revokeObjectURL(porFoto.previa);
      setPorFoto({ previa: URL.createObjectURL(miniatura), analisando: true, candidatos: [] });
      const vetor = await vetorDaImagem(imagem);
      const achados = await buscarPorVetor(db, vetor, { limite: 5 });
      const modelos = await db.modelos.bulkGet(achados.map((a) => a.modeloId));
      const candidatos = achados.flatMap((a, i) => (modelos[i] ? [{ modelo: modelos[i]!, similaridade: a.similaridade }] : []));
      setPorFoto((p) => (p ? { ...p, analisando: false, candidatos } : p));
      if (!candidatos.length) {
        const indexadas = (await db.fotos.toArray()).filter((f) => f.embedding).length;
        setAviso(indexadas ? "Nenhuma peça cadastrada parecida com essa foto." : "Ainda não há fotos preparadas para a busca. Elas são preparadas aos poucos depois do cadastro.");
        pedirIndexacao(0);
      }
    } catch (erro) {
      setPorFoto(null);
      setAviso(`Não deu para analisar a foto${navigator.onLine ? "" : " (na primeira vez, precisa de internet para baixar o reconhecimento)"}: ${erro instanceof Error ? erro.message : erro}`);
    }
  }

  useEffect(() => {
    const t = texto.trim();
    if (!t) return;
    let vivo = true;
    (async () => {
      const lista: Modelo[] = [];
      // Código, QR ou etiqueta antiga (a de "peças diversas" traz todas as peças da faixa).
      lista.push(...(await lerCodigo(db, t)).modelos);
      for (const m of await buscarModelosPorNome(db, t, 20)) if (!lista.some((x) => x.id === m.id)) lista.push(m);
      if (vivo) setResultados(lista);
    })();
    return () => {
      vivo = false;
    };
  }, [texto, db]);

  const aoLer = useCallback(async (lido: string) => {
    setLendo(false);
    const r = await lerCodigo(db, lido);
    if (!r.ambiguo && r.modelos.length === 1) return router.push(`/modelo?id=${r.modelos[0].id}`);
    setTexto(lido);
    if (r.ambiguo) {
      setAviso(`Etiqueta de peças diversas: ${r.modelos.length ? `${r.modelos.length} peças cadastradas com ela. Confira pela foto.` : "nenhuma peça cadastrada com ela ainda."}`);
    } else {
      setAviso(r.item ? `“${r.item.nomeSugerido}” está no Innosystem, mas ainda não foi contado aqui.` : `Nada encontrado para ${lido}.`);
    }
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
      {visaoSuportada() && (
        <button className="botao grande secundario" onClick={() => inputFoto.current?.click()}>Buscar por foto</button>
      )}
      <input ref={inputFoto} type="file" accept="image/*" capture="environment" hidden onChange={buscarFoto} />
      {porFoto && (
        <div className="cartao">
          <div className="linha-modelo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={porFoto.previa} alt="" className="mini" />
            <div>
              <strong>{porFoto.analisando ? "Procurando peças parecidas…" : porFoto.candidatos.length ? "Mais parecidas" : "Nada parecido"}</strong>
              {porFoto.analisando && <span>Na primeira vez, baixa o reconhecimento (~50 MB). Depois funciona sem internet.</span>}
            </div>
          </div>
          <ul className="lista">
            {porFoto.candidatos.map(({ modelo: m, similaridade }) => (
              <li key={m.id}>
                <Link href={`/modelo?id=${m.id}`} className="linha-modelo">
                  <FotoPrincipal modeloId={m.id} />
                  <div>
                    <strong>{m.codigo} · {m.nome || "sem nome"}</strong>
                    <span><Preco centavos={precoAtual(m).centavos} provisorio={precoAtual(m).origem === "provisorio"} /> · {Math.round(similaridade * 100)}% parecida</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
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
