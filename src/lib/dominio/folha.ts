/** Geometria das folhas de etiqueta. Todas as medidas em milímetros. */

export interface ModeloFolha {
  nome: string;
  larguraPaginaMm: number;
  alturaPaginaMm: number;
  larguraEtiquetaMm: number;
  alturaEtiquetaMm: number;
  colunas: number;
  linhas: number;
  margemSuperiorMm: number;
  margemEsquerdaMm: number;
  /** Espaço entre colunas e entre linhas. */
  espacoHorizontalMm: number;
  espacoVerticalMm: number;
  /** Ajuste fino aplicado a todas as etiquetas (positivo = direita / para baixo). */
  ajusteXMm: number;
  ajusteYMm: number;
}

/**
 * Pimaco A4349: 15 × 26 mm, 126 por folha A4 (7 colunas × 18 linhas, etiqueta deitada).
 * Margens centralizadas sem espaço entre etiquetas; conferir no primeiro teste de impressão
 * e corrigir com o ajuste fino.
 */
export const FOLHA_A4349: ModeloFolha = {
  nome: "Pimaco A4349",
  larguraPaginaMm: 210,
  alturaPaginaMm: 297,
  larguraEtiquetaMm: 26,
  alturaEtiquetaMm: 15,
  colunas: 7,
  linhas: 18,
  margemSuperiorMm: (297 - 18 * 15) / 2,
  margemEsquerdaMm: (210 - 7 * 26) / 2,
  espacoHorizontalMm: 0,
  espacoVerticalMm: 0,
  ajusteXMm: 0,
  ajusteYMm: 0,
};

export function etiquetasPorFolha(f: ModeloFolha): number {
  return f.colunas * f.linhas;
}

export interface PosicaoEtiqueta {
  pagina: number;
  coluna: number;
  linha: number;
  /** Canto superior esquerdo, a partir do canto superior esquerdo da página. */
  xMm: number;
  yMm: number;
}

/** Posição da etiqueta de índice `i` (0 = primeira etiqueta da primeira folha), preenchendo por linha. */
export function posicaoEtiqueta(f: ModeloFolha, i: number): PosicaoEtiqueta {
  const porFolha = etiquetasPorFolha(f);
  const pagina = Math.floor(i / porFolha);
  const resto = i % porFolha;
  const linha = Math.floor(resto / f.colunas);
  const coluna = resto % f.colunas;
  return {
    pagina,
    coluna,
    linha,
    xMm: f.margemEsquerdaMm + coluna * (f.larguraEtiquetaMm + f.espacoHorizontalMm) + f.ajusteXMm,
    yMm: f.margemSuperiorMm + linha * (f.alturaEtiquetaMm + f.espacoVerticalMm) + f.ajusteYMm,
  };
}

/** Problemas de geometria (etiqueta saindo da página). Lista vazia = ok. */
export function validarFolha(f: ModeloFolha): string[] {
  const erros: string[] = [];
  if (f.colunas < 1 || f.linhas < 1) erros.push("Colunas e linhas precisam ser pelo menos 1.");
  const direita =
    f.margemEsquerdaMm + f.colunas * f.larguraEtiquetaMm + (f.colunas - 1) * f.espacoHorizontalMm + f.ajusteXMm;
  const baixo =
    f.margemSuperiorMm + f.linhas * f.alturaEtiquetaMm + (f.linhas - 1) * f.espacoVerticalMm + f.ajusteYMm;
  if (f.margemEsquerdaMm + f.ajusteXMm < 0 || direita > f.larguraPaginaMm + 0.01)
    erros.push("As etiquetas passam da largura da página.");
  if (f.margemSuperiorMm + f.ajusteYMm < 0 || baixo > f.alturaPaginaMm + 0.01)
    erros.push("As etiquetas passam da altura da página.");
  return erros;
}
