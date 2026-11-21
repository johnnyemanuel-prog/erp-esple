"use client";
/** Exportação em CSV (abre no Excel em pt-BR: ";" e vírgula decimal, com BOM). */
import { precoAtual } from "@/lib/dominio/preco";
import type { BancoEsplendida } from "@/lib/offline/db";

const reais = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
const campo = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function gerarPlanilhaModelos(db: BancoEsplendida): Promise<string> {
  const [modelos, locais, movs] = await Promise.all([db.modelos.toArray(), db.locais.toArray(), db.movimentacoes.toArray()]);
  const saldo = new Map<string, number>();
  for (const m of movs) {
    if (m.localDestinoId) saldo.set(`${m.modeloId}|${m.localDestinoId}`, (saldo.get(`${m.modeloId}|${m.localDestinoId}`) ?? 0) + m.quantidade);
    if (m.localOrigemId) saldo.set(`${m.modeloId}|${m.localOrigemId}`, (saldo.get(`${m.modeloId}|${m.localOrigemId}`) ?? 0) - m.quantidade);
  }
  modelos.sort((a, b) => a.codigo.localeCompare(b.codigo));
  const cab = [
    "Código", "Nome", "Categoria", "Banho", "Referência", "Código de barras Innosystem", "Aros disponíveis",
    "Custo", "Preço", "Origem do preço", "Preço na etiqueta", "Status", "Estoque total",
    ...locais.map((l) => `Estoque: ${l.nome}`),
  ];
  const linhas = modelos.map((m) => {
    const p = precoAtual(m);
    const porLocal = locais.map((l) => saldo.get(`${m.id}|${l.id}`) ?? 0);
    return [
      m.codigo, m.nome, m.categoria, m.banho, m.referencia, m.codigoBarrasInnosystem, m.arosDisponiveis,
      reais(m.custoCentavos), reais(p.centavos),
      { tabela: "tabela", provisorio: "provisório", sem_preco: "sem preço" }[p.origem],
      reais(m.precoImpressoCentavos), m.status, porLocal.reduce((a, b) => a + b, 0), ...porLocal,
    ].map(campo).join(";");
  });
  return "﻿" + [cab.map(campo).join(";"), ...linhas].join("\r\n");
}

export function baixarArquivo(conteudo: BlobPart, nome: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
