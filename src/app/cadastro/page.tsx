import { Suspense } from "react";
import Tela from "@/telas/Cadastro";

export default function Pagina() {
  return (
    <Suspense fallback={<p className="carregando">Carregando…</p>}>
      <Tela />
    </Suspense>
  );
}
