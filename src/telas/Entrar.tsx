"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/app/supabase";

export default function Entrar() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setMsg(null);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password: senha });
    setOcupado(false);
    if (error) {
      setMsg({ tipo: "erro", texto: error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message });
      return;
    }
    router.replace("/");
  }

  async function esqueci() {
    if (!email.trim()) {
      setMsg({ tipo: "erro", texto: "Digite o e-mail primeiro." });
      return;
    }
    setOcupado(true);
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nova-senha`,
    });
    setOcupado(false);
    setMsg(
      error
        ? { tipo: "erro", texto: error.message }
        : { tipo: "ok", texto: "Mandamos um link para o seu e-mail. Abra no celular para criar a senha nova." },
    );
  }

  return (
    <form className="entrar" onSubmit={entrar}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Esplêndida Semijoias" className="logo-entrar" width={562} height={640} />
      <label className="campo">
        <span>E-mail</span>
        <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="campo">
        <span>Senha</span>
        <input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
      </label>
      {msg && <p className={msg.tipo === "erro" ? "aviso" : "sucesso"}>{msg.texto}</p>}
      <button className="botao" disabled={ocupado}>Entrar</button>
      <button type="button" className="botao link" onClick={esqueci} disabled={ocupado}>
        Esqueci minha senha
      </button>
    </form>
  );
}
