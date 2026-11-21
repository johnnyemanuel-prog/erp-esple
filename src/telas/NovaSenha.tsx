"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/app/supabase";

/** Aberta pelo link do e-mail de "esqueci a senha" ou pelo menu (trocar senha). */
export default function NovaSenha() {
  const router = useRouter();
  const [pronto, setPronto] = useState<boolean | null>(null);
  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabase();
    // O link do e-mail traz a sessão no endereço; o cliente a lê sozinho.
    const { data } = sb.auth.onAuthStateChange((_e, s) => s && setPronto(true));
    sb.auth.getSession().then(({ data: d }) => setPronto(!!d.session || null));
    const t = setTimeout(() => setPronto((p) => p ?? false), 4000);
    return () => {
      data.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) return setMsg("Use pelo menos 8 caracteres.");
    if (senha !== repetir) return setMsg("As duas senhas não são iguais.");
    const { error } = await supabase().auth.updateUser({ password: senha });
    if (error) return setMsg(error.message);
    router.replace("/");
  }

  if (pronto === null) return <p className="carregando">Abrindo…</p>;
  if (!pronto)
    return (
      <div className="entrar">
        <p className="aviso">O link expirou ou já foi usado. Peça outro em “Esqueci minha senha”.</p>
        <button className="botao" onClick={() => router.replace("/entrar")}>Voltar</button>
      </div>
    );

  return (
    <form className="entrar" onSubmit={salvar}>
      <h1>Nova senha</h1>
      <label className="campo">
        <span>Senha nova</span>
        <input type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
      </label>
      <label className="campo">
        <span>Repita a senha</span>
        <input type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} />
      </label>
      {msg && <p className="aviso">{msg}</p>}
      <button className="botao">Salvar senha</button>
    </form>
  );
}
