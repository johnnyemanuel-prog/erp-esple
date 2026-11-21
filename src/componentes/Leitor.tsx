"use client";
/**
 * Leitor de QR e código de barras pela câmera, usando o BarcodeDetector do Chrome no Android.
 * Sem suporte (ou sem permissão de câmera), mostra o aviso e ela digita.
 */
import { useEffect, useRef, useState } from "react";

interface Detector {
  detect(fonte: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: {
      new (opts?: { formats: string[] }): Detector;
      getSupportedFormats(): Promise<string[]>;
    };
  }
}

const FORMATOS = ["qr_code", "code_128", "code_39", "code_93", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "codabar"];

export function leitorDisponivel() {
  return typeof window !== "undefined" && !!window.BarcodeDetector && !!navigator.mediaDevices?.getUserMedia;
}

export function Leitor({ onLido, onFechar }: { onLido: (texto: string) => void; onFechar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let parar = false;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        if (!window.BarcodeDetector) throw new Error("Este navegador não lê códigos pela câmera. Use o Chrome ou digite.");
        const suportados = await window.BarcodeDetector.getSupportedFormats();
        const detector = new window.BarcodeDetector({ formats: FORMATOS.filter((f) => suportados.includes(f)) });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        while (!parar) {
          const achados = await detector.detect(v).catch(() => []);
          const valor = achados.find((a) => a.rawValue?.trim())?.rawValue.trim();
          if (valor) {
            navigator.vibrate?.(60);
            onLido(valor);
            return;
          }
          await new Promise((r) => setTimeout(r, 150));
        }
      } catch (e) {
        setErro(e instanceof Error && e.name === "NotAllowedError" ? "Permita o uso da câmera para ler códigos." : e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      parar = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onLido]);

  return (
    <div className="leitor">
      {erro ? <p className="aviso">{erro}</p> : <video ref={video} playsInline muted />}
      {!erro && <div className="mira" />}
      <button className="botao secundario" onClick={onFechar}>
        Fechar câmera
      </button>
    </div>
  );
}
