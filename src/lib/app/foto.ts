"use client";
/** Compressão no próprio celular: ~1024 px em WebP e miniatura de ~200 px. */

async function redimensionar(fonte: ImageBitmap, lado: number, qualidade: number): Promise<Blob> {
  const escala = Math.min(1, lado / Math.max(fonte.width, fonte.height));
  const w = Math.round(fonte.width * escala);
  const h = Math.round(fonte.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(fonte, 0, 0, w, h);
  return new Promise((ok, erro) =>
    canvas.toBlob((b) => (b ? ok(b) : erro(new Error("Não deu para comprimir a foto"))), "image/webp", qualidade),
  );
}

export async function comprimirFoto(arquivo: Blob): Promise<{ imagem: Blob; miniatura: Blob }> {
  const bmp = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  try {
    const [imagem, miniatura] = await Promise.all([redimensionar(bmp, 1024, 0.82), redimensionar(bmp, 200, 0.75)]);
    return { imagem, miniatura };
  } finally {
    bmp.close();
  }
}
