/**
 * Banco local do celular (IndexedDB via Dexie). Todo cadastro grava aqui primeiro
 * e entra na fila de sincronização; o Supabase recebe depois, quando houver internet.
 */
import Dexie, { type EntityTable } from "dexie";
import type { ItemCatalogo } from "@/lib/innosystem/importar";

interface Base {
  id: string;
  atualizadoEm: string; // ISO
}

export interface Local extends Base {
  nome: string;
  responsavel?: string | null;
  ativo: boolean;
}

export interface Fornecedora extends Base {
  nome: string;
  cnpj?: string | null;
  formatoNota?: "xml" | "pdf" | "foto" | null;
}

export interface SessaoContagem extends Base {
  nome: string;
  localId: string;
  inicio: string;
  fim?: string | null;
}

export interface Modelo extends Base {
  codigo: string;
  nome?: string | null;
  referencia?: string | null;
  codigoBarrasInnosystem?: string | null;
  categoria?: string | null;
  banho?: string | null;
  arosDisponiveis?: string | null;
  custoCentavos?: number | null;
  precoProvisorioCentavos?: number | null;
  precoImpressoCentavos?: number | null;
  etiquetaImpressaEm?: string | null;
  status: "rascunho" | "completo";
  ncm?: string | null;
  origem?: string | null;
  fornecedoraId?: string | null;
  embedding?: number[] | null;
  embeddingModelo?: string | null;
  criadoEm: string;
}

export interface FotoModelo extends Base {
  modeloId: string;
  principal: boolean;
  ordem: number;
  /** Imagem ~1024 px WebP; fica no aparelho até subir para o Storage. */
  imagem?: Blob | null;
  miniatura?: Blob | null;
  caminho?: string | null;
  caminhoMiniatura?: string | null;
  /** Vetor da foto (busca por foto), calculado no celular. */
  embedding?: number[] | null;
  embeddingModelo?: string | null;
}

export type TipoMovimentacao = "entrada" | "transferencia" | "venda" | "ajuste";

export interface Movimentacao extends Base {
  modeloId: string;
  localOrigemId?: string | null;
  localDestinoId?: string | null;
  quantidade: number;
  tipo: TipoMovimentacao;
  sessaoId?: string | null;
  observacao?: string | null;
  data: string;
}

/** Catálogo do Innosystem (só consulta). A chave é o código interno do Innosystem. */
export type { ItemCatalogo };

export type TabelaSincronizada =
  | "local"
  | "fornecedora"
  | "sessao_contagem"
  | "modelo"
  | "foto_modelo"
  | "movimentacao";

export interface ItemFila {
  seq?: number;
  tabela: TabelaSincronizada;
  registroId: string;
  criadoEm: string;
  tentativas: number;
  ultimoErro?: string | null;
}

export interface Meta {
  chave: string;
  valor: unknown;
}

export class BancoEsplendida extends Dexie {
  locais!: EntityTable<Local, "id">;
  fornecedoras!: EntityTable<Fornecedora, "id">;
  sessoes!: EntityTable<SessaoContagem, "id">;
  modelos!: EntityTable<Modelo, "id">;
  fotos!: EntityTable<FotoModelo, "id">;
  movimentacoes!: EntityTable<Movimentacao, "id">;
  catalogo!: EntityTable<ItemCatalogo, "codigoInnosystem">;
  fila!: EntityTable<ItemFila, "seq">;
  meta!: EntityTable<Meta, "chave">;

  constructor(nome = "esplendida") {
    super(nome);
    this.version(1).stores({
      locais: "id, nome",
      fornecedoras: "id, nome",
      sessoes: "id, localId, inicio",
      modelos: "id, &codigo, codigoBarrasInnosystem, referencia, status, nome",
      fotos: "id, modeloId",
      movimentacoes: "id, modeloId, sessaoId, localOrigemId, localDestinoId",
      catalogo: "codigoInnosystem, codigoBarras, referenciaNormalizada",
      fila: "++seq, [tabela+registroId]",
      meta: "chave",
    });
  }
}

let instancia: BancoEsplendida | null = null;
export function banco(): BancoEsplendida {
  instancia ??= new BancoEsplendida();
  return instancia;
}
