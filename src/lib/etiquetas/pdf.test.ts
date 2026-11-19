import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { FOLHA_A4349 } from "@/lib/dominio/folha";
import { gerarPdfEtiquetas } from "./pdf";

describe("PDF de etiquetas", () => {
  it("gera uma página por 126 etiquetas", async () => {
    const etiquetas = Array.from({ length: 130 }, (_, i) => ({
      codigo: String(i + 1).padStart(4, "0"),
      precoCentavos: i % 3 === 0 ? null : 4790,
    }));
    const bytes = await gerarPdfEtiquetas(etiquetas, FOLHA_A4349, { contorno: true });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo((210 * 72) / 25.4, 1);
    expect(height).toBeCloseTo((297 * 72) / 25.4, 1);
  });
});
