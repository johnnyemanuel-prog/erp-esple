"use client";
import { useState } from "react";
import { formatarReais, lerReais } from "@/lib/dominio/preco";

/** Campo de valor em reais: aceita "47,5", "47.50"; devolve centavos (ou null). */
export function CampoReais({
  valor, onChange, rotulo, placeholder, autoFocus,
}: { valor: number | null | undefined; onChange: (c: number | null) => void; rotulo: string; placeholder?: string; autoFocus?: boolean }) {
  const formatar = (c: number | null | undefined) => (c ? (c / 100).toFixed(2).replace(".", ",") : "");
  const [texto, setTexto] = useState(formatar(valor));
  const [anterior, setAnterior] = useState(valor ?? null);
  // O valor mudou de fora (ex.: veio do catálogo): mostra o novo, sem brigar com o que ela digita.
  if ((valor ?? null) !== anterior) {
    setAnterior(valor ?? null);
    const lido = lerReais(texto);
    if ((lido && lido > 0 ? lido : null) !== (valor ?? null)) setTexto(formatar(valor));
  }
  return (
    <label className="campo">
      <span>{rotulo}</span>
      <input
        inputMode="decimal"
        value={texto}
        placeholder={placeholder ?? "0,00"}
        autoFocus={autoFocus}
        onChange={(e) => {
          setTexto(e.target.value);
          const c = lerReais(e.target.value);
          setAnterior(c && c > 0 ? c : null);
          onChange(c && c > 0 ? c : null);
        }}
      />
    </label>
  );
}

export function Chips<T extends string>({
  opcoes, valor, onChange,
}: { opcoes: readonly T[]; valor: T | null | undefined; onChange: (v: T | null) => void }) {
  return (
    <div className="chips">
      {opcoes.map((o) => (
        <button key={o} type="button" className={o === valor ? "chip ativo" : "chip"} onClick={() => onChange(o === valor ? null : o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function Quantidade({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  return (
    <div className="quantidade">
      <button type="button" onClick={() => onChange(Math.max(1, valor - 1))} aria-label="Menos">−</button>
      <input inputMode="numeric" value={valor} onChange={(e) => onChange(Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1))} />
      <button type="button" onClick={() => onChange(valor + 1)} aria-label="Mais">+</button>
    </div>
  );
}

export function Preco({ centavos, provisorio }: { centavos: number | null; provisorio?: boolean }) {
  if (centavos == null) return <span className="preco sem">sem preço</span>;
  return (
    <span className={provisorio ? "preco provisorio" : "preco"}>
      {formatarReais(centavos)}
      {provisorio && <small> provisório</small>}
    </span>
  );
}
