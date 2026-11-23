/// <reference lib="webworker" />
/**
 * Worker da busca por foto: transforma uma imagem num vetor (MobileCLIP S0, fp16),
 * fora da tela principal para não travar o app. Tudo servido pelo próprio app (/modelos, /ort).
 */
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } from "@huggingface/transformers";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/modelos/";
env.useBrowserCache = false; // o service worker já guarda /modelos e /ort
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = "/ort/";
  env.backends.onnx.wasm.numThreads = 1;
}

type Carregado = { processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>; model: CLIPVisionModelWithProjection };
let carregando: Promise<Carregado> | null = null;

async function carregar(): Promise<Carregado> {
  const processor = await AutoProcessor.from_pretrained("mobileclip_s0");
  const nav = self.navigator as Navigator & { gpu?: unknown };
  let model: CLIPVisionModelWithProjection | null = null;
  if (nav.gpu) {
    try {
      model = (await CLIPVisionModelWithProjection.from_pretrained("mobileclip_s0", { dtype: "fp16", device: "webgpu" })) as CLIPVisionModelWithProjection;
    } catch {
      model = null; // sem WebGPU utilizável: cai para o processador comum
    }
  }
  model ??= (await CLIPVisionModelWithProjection.from_pretrained("mobileclip_s0", { dtype: "fp16", device: "wasm" })) as CLIPVisionModelWithProjection;
  return { processor, model };
}

function normalizar(v: ArrayLike<number>) {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  return Array.from(v, (x) => x / n);
}

self.onmessage = async (e: MessageEvent<{ id: number; tipo: "carregar" | "vetor"; imagem?: Blob }>) => {
  const { id, tipo, imagem } = e.data;
  try {
    carregando ??= carregar();
    const { processor, model } = await carregando;
    if (tipo === "carregar") return self.postMessage({ id, ok: true });
    const img = await RawImage.fromBlob(imagem!);
    const { image_embeds } = await model(await processor(img));
    self.postMessage({ id, vetor: normalizar(image_embeds.data as Float32Array) });
  } catch (erro) {
    carregando = null;
    self.postMessage({ id, erro: erro instanceof Error ? erro.message : String(erro) });
  }
};
