/**
 * Prepara a busca por foto antes do build: o app serve o motor de IA (ONNX Runtime em
 * WebAssembly) e o modelo de visão pelo próprio endereço, para tudo funcionar sem internet
 * depois do primeiro uso. Os arquivos ficam fora do git (ver .gitignore).
 */
import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);

// 1) Motor: os arquivos do onnxruntime-web que o transformers.js usa no navegador.
const ortDist = path.join(path.dirname(require.resolve("onnxruntime-web")), "..", "dist");
const destinoOrt = path.join(raiz, "public", "ort");
await mkdir(destinoOrt, { recursive: true });
const arquivosOrt = (await readdir(ortDist)).filter((f) => /^ort-wasm-simd-threaded\.(jsep|asyncify)\.(mjs|wasm)$/.test(f));
if (arquivosOrt.length < 4) throw new Error(`onnxruntime-web: arquivos não encontrados em ${ortDist}`);
for (const f of arquivosOrt) await copyFile(path.join(ortDist, f), path.join(destinoOrt, f));

// 2) Modelo de visão (MobileCLIP S0, fp16: a versão q8 dá vetores errados).
const MODELO = "Xenova/mobileclip_s0";
const REVISAO = "main";
const destinoModelo = path.join(raiz, "public", "modelos", "mobileclip_s0");
const arquivos = ["config.json", "preprocessor_config.json", "onnx/vision_model_fp16.onnx"];
for (const f of arquivos) {
  const destino = path.join(destinoModelo, f);
  const existe = await stat(destino).then((s) => s.size > 0).catch(() => false);
  if (existe) continue;
  await mkdir(path.dirname(destino), { recursive: true });
  const url = `https://huggingface.co/${MODELO}/resolve/${REVISAO}/${f}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Falha ao baixar ${url}: ${resp.status}`);
  await writeFile(destino, Buffer.from(await resp.arrayBuffer()));
  console.log(`baixado ${f}`);
}
console.log(`IA pronta: ${arquivosOrt.join(", ")} + ${MODELO}`);
