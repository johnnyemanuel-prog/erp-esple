/**
 * Gera o PDF A4 das etiquetas. Roda no navegador (PC ou celular) e no Node.
 * O QR é desenhado em vetor (um quadradinho por módulo), para sair nítido em qualquer impressora.
 * Imprimir sempre em 100% (tamanho real), sem "ajustar à página".
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { conteudoQr, linhasEtiqueta } from "@/lib/dominio/etiqueta";
import { posicaoEtiqueta, type ModeloFolha } from "@/lib/dominio/folha";

const PT_POR_MM = 72 / 25.4;
const mm = (v: number) => v * PT_POR_MM;

export interface EtiquetaParaImprimir {
  codigo: string;
  precoCentavos: number | null;
}

export interface OpcoesPdf {
  /** Lado do QR em mm (spec: ~12 mm). */
  ladoQrMm?: number;
  /** Folga interna da etiqueta em mm. */
  folgaMm?: number;
  /** Desenha o contorno de cada etiqueta (para teste de alinhamento em papel comum). */
  contorno?: boolean;
}

export async function gerarPdfEtiquetas(
  etiquetas: EtiquetaParaImprimir[],
  folha: ModeloFolha,
  opcoes: OpcoesPdf = {},
): Promise<Uint8Array> {
  const { ladoQrMm = 12, folgaMm = 1, contorno = false } = opcoes;
  const doc = await PDFDocument.create();
  doc.setTitle("Etiquetas Esplêndida");
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);

  const paginas: PDFPage[] = [];
  const pagina = (n: number) => {
    while (paginas.length <= n) {
      paginas.push(doc.addPage([mm(folha.larguraPaginaMm), mm(folha.alturaPaginaMm)]));
    }
    return paginas[n];
  };

  if (etiquetas.length === 0) pagina(0);

  etiquetas.forEach((et, i) => {
    const pos = posicaoEtiqueta(folha, i);
    const p = pagina(pos.pagina);
    const alturaPagina = folha.alturaPaginaMm;
    // pdf-lib usa origem no canto inferior esquerdo.
    const x0 = pos.xMm;
    const yTopo = pos.yMm;

    if (contorno) {
      p.drawRectangle({
        x: mm(x0),
        y: mm(alturaPagina - yTopo - folha.alturaEtiquetaMm),
        width: mm(folha.larguraEtiquetaMm),
        height: mm(folha.alturaEtiquetaMm),
        borderColor: rgb(0.7, 0.7, 0.7),
        borderWidth: 0.3,
      });
    }

    // QR à esquerda, centralizado na altura.
    const lado = Math.min(ladoQrMm, folha.alturaEtiquetaMm - 2 * folgaMm);
    const qrX = x0 + folgaMm;
    const qrYTopo = yTopo + (folha.alturaEtiquetaMm - lado) / 2;
    desenharQr(p, conteudoQr(et.codigo), mm(qrX), mm(alturaPagina - qrYTopo - lado), mm(lado));

    // Duas linhas à direita: código e preço disfarçado.
    const [linha1, linha2] = linhasEtiqueta(et.codigo, et.precoCentavos);
    const xTexto = qrX + lado + folgaMm;
    const larguraTexto = x0 + folha.larguraEtiquetaMm - folgaMm - xTexto;
    const meio = alturaPagina - yTopo - folha.alturaEtiquetaMm / 2;
    escreverAjustado(p, linha1, negrito, mm(xTexto), meio, mm(larguraTexto), 12, "acima");
    escreverAjustado(p, linha2, normal, mm(xTexto), meio, mm(larguraTexto), 11, "abaixo");
  });

  return doc.save();
}

function desenharQr(p: PDFPage, texto: string, x: number, y: number, lado: number) {
  const qr = QRCode.create(texto, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const modulo = lado / n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) {
        // Um leve excesso evita frestas brancas entre módulos vizinhos.
        p.drawRectangle({
          x: x + c * modulo,
          y: y + (n - 1 - r) * modulo,
          width: modulo + 0.05,
          height: modulo + 0.05,
          color: rgb(0, 0, 0),
        });
      }
    }
  }
}

/** Escreve o texto no maior tamanho (até `tamanhoMax` pt) que caiba na largura. */
function escreverAjustado(
  p: PDFPage,
  texto: string,
  fonte: PDFFont,
  x: number,
  yMeioMm: number,
  largura: number,
  tamanhoMax: number,
  lado: "acima" | "abaixo",
) {
  let tamanho = tamanhoMax;
  while (tamanho > 5 && fonte.widthOfTextAtSize(texto, tamanho) > largura) tamanho -= 0.5;
  const alturaCaps = fonte.heightAtSize(tamanho, { descender: false });
  const folga = mm(0.8);
  const yMeio = mm(yMeioMm);
  const y = lado === "acima" ? yMeio + folga : yMeio - folga - alturaCaps;
  p.drawText(texto, { x, y, size: tamanho, font: fonte, color: rgb(0, 0, 0) });
}
