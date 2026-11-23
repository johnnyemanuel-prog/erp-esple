"use client";
/**
 * Cadastro rápido de um montinho (meta: menos de 30 segundos).
 * Ler a etiqueta antiga → foto → quantidade → custo (já vem do catálogo) → salvar.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BANHOS_PADRAO, CATEGORIAS_PADRAO, deduzirBanho, deduzirCategoria } from "@/lib/dominio/deducao";
import { precoTabela } from "@/lib/dominio/preco";
import { banco, type Modelo } from "@/lib/offline/db";
import {
  buscarModelosPorNome, buscarPorNome, ehItemGenerico, lerCodigo, preencherDoCatalogo,
} from "@/lib/offline/catalogo";
import { cadastrarMontinho, salvarFoto, somarAoModelo } from "@/lib/offline/repositorio";
import type { ItemCatalogo } from "@/lib/innosystem/importar";
import { comprimirFoto } from "@/lib/app/foto";
import { LIMIAR_PARECIDO, MODELO_VISAO } from "@/lib/dominio/similaridade";
import { buscarPorVetor } from "@/lib/offline/indexar";
import { pedirIndexacao, vetorDaImagem, visaoSuportada } from "@/lib/ia/visao";
import { pedirSincronizacao } from "@/lib/app/sync";
import { CampoReais, Chips, Preco, Quantidade } from "@/componentes/Campos";
import { FotoPrincipal } from "@/componentes/Foto";
import { Leitor, leitorDisponivel } from "@/componentes/Leitor";

const CATEGORIAS = CATEGORIAS_PADRAO.map((c) => c.nome);
const BANHOS = BANHOS_PADRAO.map((b) => b.nome);

interface Form {
  nome: string;
  referencia: string;
  codigoBarras: string | null;
  categoria: string | null;
  banho: string | null;
  aros: string;
  custo: number | null;
  precoProvisorio: number | null;
  soPreco: boolean;
  quantidade: number;
}
const VAZIO: Form = {
  nome: "", referencia: "", codigoBarras: null, categoria: null, banho: null, aros: "",
  custo: null, precoProvisorio: null, soPreco: false, quantidade: 1,
};

export default function Cadastro() {
  const sessaoId = useSearchParams().get("sessao") ?? "";
  const db = banco();
  const sessao = useLiveQuery(() => db.sessoes.get(sessaoId), [sessaoId]);

  const [f, setF] = useState<Form>(VAZIO);
  const [tocados, setTocados] = useState<{ categoria?: boolean; banho?: boolean }>({});
  const [doCatalogo, setDoCatalogo] = useState<ItemCatalogo | null>(null);
  const [existente, setExistente] = useState<Modelo | null>(null);
  const [foto, setFoto] = useState<{ imagem: Blob; miniatura: Blob; url: string; vetor?: number[] } | null>(null);
  const [parecidos, setParecidos] = useState<{ modelo: Modelo; similaridade: number }[]>([]);
  /** Etiqueta genérica ("peças diversas"): as peças já cadastradas com ela, para ela escolher. */
  const [escolha, setEscolha] = useState<{ item: ItemCatalogo | null; modelos: Modelo[] } | null>(null);
  const [notas, setNotas] = useState<Map<string, number>>(new Map());
  const [lendo, setLendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<{ codigo: string; nome: string; somado: boolean } | null>(null);
  const [sugestoes, setSugestoes] = useState<{ modelos: Modelo[]; catalogo: ItemCatalogo[] }>({ modelos: [], catalogo: [] });
  const [salvando, setSalvando] = useState(false);
  const inputFoto = useRef<HTMLInputElement>(null);

  const mudar = (p: Partial<Form>) => setF((a) => ({ ...a, ...p }));

  // Dedução de categoria e banho pelo nome, enquanto ela não escolher na mão.
  const categoria = tocados.categoria ? f.categoria : (doCatalogo?.categoria ?? deduzirCategoria(f.nome) ?? f.categoria);
  const banho = tocados.banho ? f.banho : (deduzirBanho(f.nome) ?? f.banho);

  // Autocompletar: modelos já cadastrados primeiro, depois o catálogo do Innosystem.
  const buscarSugestoes = !doCatalogo && !existente && f.nome.trim().length >= 2;
  useEffect(() => {
    if (!buscarSugestoes) return;
    let vivo = true;
    const t = setTimeout(async () => {
      const [modelos, catalogo] = await Promise.all([buscarModelosPorNome(db, f.nome, 4), buscarPorNome(db, f.nome, 8)]);
      if (vivo) setSugestoes({ modelos, catalogo });
    }, 150);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [f.nome, buscarSugestoes, db]);
  const sugestoesVisiveis = buscarSugestoes ? sugestoes : { modelos: [], catalogo: [] };

  // Com a foto e uma etiqueta genérica: ordena as peças daquela faixa pela semelhança.
  const vetorFoto = foto?.vetor;
  useEffect(() => {
    if (!vetorFoto || !escolha?.modelos.length) return;
    let vivo = true;
    buscarPorVetor(db, vetorFoto, { limite: 1000, minimo: -1 }).then((r) => {
      if (vivo) setNotas(new Map(r.map((c) => [c.modeloId, c.similaridade])));
    });
    return () => {
      vivo = false;
    };
  }, [vetorFoto, escolha, db]);
  const modelosEscolha = escolha
    ? [...escolha.modelos].sort((a, b) => (notas.get(b.id) ?? -2) - (notas.get(a.id) ?? -2))
    : [];

  const usarCatalogo = useCallback(async (item: ItemCatalogo) => {
    const p = preencherDoCatalogo(item);
    if (ehItemGenerico(item)) {
      // "Peças diversas": o código e o custo da faixa valem, mas o nome é da peça, não da etiqueta.
      setF((a) => ({ ...a, codigoBarras: item.codigoBarras, custo: p.custoCentavos ?? a.custo, soPreco: p.custoCentavos ? false : a.soPreco }));
      return;
    }
    setDoCatalogo(item);
    setSugestoes({ modelos: [], catalogo: [] });
    setF((a) => ({
      ...a,
      nome: p.nome ?? a.nome,
      referencia: p.referencia ?? "",
      codigoBarras: p.codigoBarrasInnosystem ?? null,
      categoria: p.categoria ?? a.categoria,
      banho: p.banho ?? a.banho,
      custo: p.custoCentavos ?? a.custo,
      soPreco: p.custoCentavos ? false : a.soPreco,
    }));
    if (item.codigoBarras) {
      const m = await db.modelos.where("codigoBarrasInnosystem").equals(item.codigoBarras).first();
      if (m) setExistente(m);
    }
  }, [db]);

  const aoLer = useCallback(async (texto: string) => {
    setLendo(false);
    setAviso(null);
    const r = await lerCodigo(db, texto);
    if (r.ambiguo) {
      if (r.item) await usarCatalogo(r.item);
      else setF((a) => ({ ...a, codigoBarras: texto }));
      setEscolha({ item: r.item, modelos: r.modelos });
      return;
    }
    if (r.modelos.length === 1) {
      setExistente(r.modelos[0]);
      return;
    }
    if (r.item) return usarCatalogo(r.item);
    setF((a) => ({ ...a, codigoBarras: texto }));
    setAviso(`Código ${texto} não está no catálogo do Innosystem. Digite o nome.`);
  }, [db, usarCatalogo]);

  async function escolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0];
    e.target.value = "";
    if (!arq) return;
    try {
      const c = await comprimirFoto(arq);
      if (foto) URL.revokeObjectURL(foto.url);
      const url = URL.createObjectURL(c.miniatura);
      setFoto({ ...c, url });
      setParecidos([]);
      // Aviso de duplicata: em segundo plano, sem segurar o cadastro.
      if (visaoSuportada()) {
        vetorDaImagem(c.imagem)
          .then(async (vetor) => {
            setFoto((f) => (f && f.url === url ? { ...f, vetor } : f));
            const achados = await buscarPorVetor(db, vetor, { limite: 3, minimo: LIMIAR_PARECIDO, ignorarModeloId: existente?.id });
            const modelos = await db.modelos.bulkGet(achados.map((a) => a.modeloId));
            setParecidos(achados.flatMap((a, i) => (modelos[i] ? [{ modelo: modelos[i]!, similaridade: a.similaridade }] : [])));
          })
          .catch((e) => console.warn("Busca por foto indisponível:", e));
      }
    } catch (erro) {
      setAviso(erro instanceof Error ? erro.message : "Não deu para usar a foto.");
    }
  }

  function limpar() {
    if (foto) URL.revokeObjectURL(foto.url);
    setF(VAZIO);
    setTocados({});
    setDoCatalogo(null);
    setExistente(null);
    setFoto(null);
    setParecidos([]);
    setEscolha(null);
    setNotas(new Map());
    setAviso(null);
  }

  async function salvar() {
    if (!sessao || salvando) return;
    setSalvando(true);
    try {
      if (existente) {
        await somarAoModelo(db, { modeloId: existente.id, quantidade: f.quantidade, sessao });
        if (foto) await salvarFoto(db, { modeloId: existente.id, imagem: foto.imagem, miniatura: foto.miniatura, embedding: foto.vetor, embeddingModelo: MODELO_VISAO });
        setSalvo({ codigo: existente.codigo, nome: existente.nome ?? "", somado: true });
      } else {
        const { modelo } = await cadastrarMontinho(db, {
          sessao,
          quantidade: f.quantidade,
          dados: {
            nome: f.nome.trim() || null,
            referencia: f.referencia.trim() || null,
            codigoBarrasInnosystem: f.codigoBarras,
            categoria,
            banho,
            arosDisponiveis: f.aros.trim() || null,
            custoCentavos: f.soPreco ? null : f.custo,
            precoProvisorioCentavos: f.soPreco ? f.precoProvisorio : null,
            ncm: doCatalogo?.ncm ?? null,
          },
        });
        if (foto) await salvarFoto(db, { modeloId: modelo.id, imagem: foto.imagem, miniatura: foto.miniatura, embedding: foto.vetor, embeddingModelo: MODELO_VISAO });
        setSalvo({ codigo: modelo.codigo, nome: modelo.nome ?? "", somado: false });
      }
      pedirSincronizacao();
      if (foto && !foto.vetor) pedirIndexacao();
      limpar();
      window.scrollTo({ top: 0 });
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  if (sessao === undefined) return <p className="carregando">Carregando…</p>;
  if (!sessao) return <p className="aviso">Sessão não encontrada. <Link href="/sessoes">Voltar</Link></p>;
  if (sessao.fim) return <p className="aviso">Esta sessão já foi fechada. <Link href="/sessoes">Abrir outra</Link></p>;

  const precoCalc = !f.soPreco && f.custo ? precoTabela(f.custo) : null;

  return (
    <div className="cadastro">
      <div className="topo-cadastro">
        <Link href={`/sessao?id=${sessao.id}`}>← {sessao.nome}</Link>
      </div>

      {salvo && (
        <p className="sucesso grande">
          {salvo.somado ? "Somado a" : "Salvo"} <strong>{salvo.codigo}</strong> {salvo.nome}
        </p>
      )}

      {lendo ? (
        <Leitor onLido={aoLer} onFechar={() => setLendo(false)} />
      ) : (
        !existente && !doCatalogo && (
          <button className="botao grande" onClick={() => (leitorDisponivel() ? setLendo(true) : setAviso("Este navegador não lê códigos pela câmera. Digite o nome."))}>
            Ler etiqueta antiga
          </button>
        )
      )}

      {aviso && <p className="aviso">{aviso}</p>}

      {escolha && !existente && (
        <div className="cartao destaque">
          <strong>
            Etiqueta de peças diversas{escolha.item?.custoCentavos ? ` (custo ${(escolha.item.custoCentavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})` : ""}
          </strong>
          {modelosEscolha.length ? (
            <>
              <p>Essa etiqueta é usada em várias peças. Qual destas é{foto?.vetor ? " (as mais parecidas com a foto primeiro)" : "? Tire a foto para ordenar pelas mais parecidas"}?</p>
              <ul className="lista">
                {modelosEscolha.map((m) => (
                  <li key={m.id} className="linha-estoque">
                    <div className="linha-modelo">
                      <FotoPrincipal modeloId={m.id} />
                      <div>
                        <strong>{m.codigo} · {m.nome || "sem nome"}</strong>
                        {notas.has(m.id) && <span>{Math.max(0, Math.round(notas.get(m.id)! * 100))}% parecida</span>}
                      </div>
                    </div>
                    <button className="botao pequeno" onClick={() => setExistente(m)}>Somar a este</button>
                  </li>
                ))}
              </ul>
              <p className="sub">Se for outra peça, digite o nome abaixo: ela vira um modelo novo com o custo da faixa.</p>
            </>
          ) : (
            <p>Nenhuma peça cadastrada com essa etiqueta ainda. Digite o nome da peça: ela vira um modelo novo com o custo da faixa.</p>
          )}
        </div>
      )}

      {existente ? (
        <div className="cartao destaque">
          <div className="linha-modelo">
            <FotoPrincipal modeloId={existente.id} />
            <div>
              <strong>Já cadastrado: {existente.codigo}</strong>
              <span>{existente.nome || "sem nome"}</span>
            </div>
          </div>
          <p>As peças deste montinho vão ser somadas a esse modelo.</p>
          <button className="botao link" onClick={() => setExistente(null)}>
            {escolha ? "Não é este: voltar à lista" : "Não é o mesmo: cadastrar como novo"}
          </button>
        </div>
      ) : (
        <>
          <label className="campo">
            <span>Nome {doCatalogo && <small>(do Innosystem: {doCatalogo.nome})</small>}</span>
            <input
              value={f.nome}
              onChange={(e) => {
                mudar({ nome: e.target.value });
                if (doCatalogo) setDoCatalogo(null);
              }}
              placeholder="Digite parte do nome"
              autoComplete="off"
            />
          </label>
          {/^\d{6,14}$/.test(f.nome.trim()) && (
            <ul className="sugestoes">
              <li>
                <button type="button" onClick={() => { const c = f.nome.trim(); mudar({ nome: "" }); void aoLer(c); }}>
                  Buscar etiqueta <strong>{f.nome.trim()}</strong> <small>código de barras digitado</small>
                </button>
              </li>
            </ul>
          )}
          {(sugestoesVisiveis.modelos.length > 0 || sugestoesVisiveis.catalogo.length > 0) && (
            <ul className="sugestoes">
              {sugestoesVisiveis.modelos.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => { setExistente(m); setSugestoes({ modelos: [], catalogo: [] }); }}>
                    <strong>{m.codigo}</strong> {m.nome} <small>já cadastrado</small>
                  </button>
                </li>
              ))}
              {sugestoesVisiveis.catalogo.map((c) => (
                <li key={c.codigoInnosystem}>
                  <button type="button" onClick={() => usarCatalogo(c)}>
                    {c.nomeSugerido} <small>{c.referencia ?? ""}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="foto-linha">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto.url} alt="" className="foto-previa" onClick={() => inputFoto.current?.click()} />
        ) : (
          <button className="botao secundario grande" onClick={() => inputFoto.current?.click()}>
            {existente ? "Foto extra (opcional)" : "Tirar foto"}
          </button>
        )}
        <input ref={inputFoto} type="file" accept="image/*" capture="environment" hidden onChange={escolherFoto} />
      </div>

      {!existente && !escolha && parecidos.length > 0 && (
        <div className="cartao destaque">
          <strong>Parece com {parecidos.map((p) => p.modelo.codigo).join(", ")}: é o mesmo?</strong>
          <ul className="lista">
            {parecidos.map(({ modelo: m, similaridade }) => (
              <li key={m.id} className="linha-estoque">
                <div className="linha-modelo">
                  <FotoPrincipal modeloId={m.id} />
                  <div>
                    <strong>{m.codigo} · {m.nome || "sem nome"}</strong>
                    <span>{Math.round(similaridade * 100)}% parecida</span>
                  </div>
                </div>
                <button className="botao pequeno" onClick={() => { setExistente(m); setParecidos([]); }}>Somar a este</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="campo">
        <span>Quantidade</span>
        <Quantidade valor={f.quantidade} onChange={(quantidade) => mudar({ quantidade })} />
      </div>

      {!existente && (
        <>
          <div className="campo">
            <span>Valor</span>
            <Chips opcoes={["Sei o custo", "Sei só o preço"] as const} valor={f.soPreco ? "Sei só o preço" : "Sei o custo"} onChange={(v) => mudar({ soPreco: v === "Sei só o preço" })} />
          </div>
          {f.soPreco ? (
            <CampoReais rotulo="Preço de venda (fica provisório)" valor={f.precoProvisorio} onChange={(precoProvisorio) => mudar({ precoProvisorio })} />
          ) : (
            <>
              <CampoReais rotulo={doCatalogo?.custoCentavos ? "Custo (do Innosystem, confira)" : "Custo"} valor={f.custo} onChange={(custo) => mudar({ custo })} />
              <p className="sub">Preço de tabela: <Preco centavos={precoCalc} /></p>
            </>
          )}

          <div className="campo">
            <span>Categoria</span>
            <Chips opcoes={CATEGORIAS} valor={categoria} onChange={(categoria) => { mudar({ categoria }); setTocados((t) => ({ ...t, categoria: true })); }} />
          </div>
          <div className="campo">
            <span>Banho</span>
            <Chips opcoes={BANHOS} valor={banho} onChange={(banho) => { mudar({ banho }); setTocados((t) => ({ ...t, banho: true })); }} />
          </div>
          {categoria === "Anel" && (
            <label className="campo">
              <span>Aros disponíveis</span>
              <input value={f.aros} onChange={(e) => mudar({ aros: e.target.value })} placeholder="14, 16, 18" />
            </label>
          )}
          <label className="campo">
            <span>Referência da fornecedora</span>
            <input value={f.referencia} onChange={(e) => mudar({ referencia: e.target.value })} autoComplete="off" />
          </label>
        </>
      )}

      <div className="rodape-fixo">
        <button className="botao grande" onClick={salvar} disabled={salvando}>
          {existente ? `Somar ${f.quantidade} a ${existente.codigo}` : "Salvar e próximo"}
        </button>
        {(f.nome || foto || existente || doCatalogo) && (
          <button className="botao link" onClick={limpar}>Limpar</button>
        )}
      </div>
    </div>
  );
}
