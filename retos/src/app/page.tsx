"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api, lastName, saveCreds, saveName } from "@/lib/client";
import { sfx } from "@/lib/sfx";
import { Icon } from "@/components/Icon";
import { Mascot } from "@/components/Mascot";

const STEPS = [
  ["Armá la sala", "Cualquiera la crea y comparte el código o el enlace. No hay anfitrión: todos juegan y el azar decide."],
  ["Escribí un reto", "Cada uno escribe uno en privado. Nadie sabe quién escribió cuál."],
  ["Votá una carta", "Hay una carta boca abajo por jugador. Todos votan sin saber quién está detrás."],
  ["Mirá la revelación", "Se da vuelta la carta: aparece el nombre y el reto. Cumplir, cambiar la prenda, comodín o retirarse."],
];

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(lastName()), []);

  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(""); sfx.unlock();
    try {
      saveName(name);
      if (mode === "create") {
        const r = await api.create(name); saveCreds(r.code, { playerId: r.playerId, token: r.token }); router.push(`/sala/${r.code}`);
      } else {
        router.push(`/sala/${code.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4)}`);
      }
    } catch (x) { setErr(x instanceof ApiError ? x.message : "No pudimos conectar."); setBusy(false); }
  };

  return (
    <main className="page home">
      <header className="hero">
        <Mascot className="hero-mascot" />
        <h1 className="logo" aria-label="Boca Abajo">
          <span aria-hidden="true">{Array.from("Boca").map((ch, i) => <b key={i} style={{ ["--i" as string]: i }}>{ch}</b>)}</span>
          <span aria-hidden="true">{Array.from("Abajo").map((ch, i) => <b key={i} style={{ ["--i" as string]: i + 4 }}>{ch}</b>)}</span>
        </h1>
        <p className="tagline">Retos entre amigos. Votan sin saber quién está detrás de cada carta.</p>
      </header>

      <form className="panel stack" onSubmit={go}>
        <div className="seg" role="tablist" aria-label="Qué querés hacer">
          <button type="button" role="tab" aria-selected={mode === "create"} className={mode === "create" ? "on" : ""} onClick={() => setMode("create")}>Crear sala</button>
          <button type="button" role="tab" aria-selected={mode === "join"} className={mode === "join" ? "on" : ""} onClick={() => setMode("join")}>Tengo un código</button>
        </div>
        {mode === "join" && (
          <div>
            <label htmlFor="c" className="h2">Código de sala</label>
            <input id="c" className="input code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={4} autoCapitalize="characters" autoComplete="off" inputMode="text" placeholder="ABCD" />
          </div>
        )}
        {mode === "create" && (
          <div>
            <label htmlFor="n" className="h2">Tu nombre</label>
            <input id="n" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoComplete="nickname" placeholder="Como te dicen tus amigos" />
          </div>
        )}
        {err && <p className="error" role="alert"><Icon name="x" size={16} /> {err}</p>}
        <button className="btn btn-primary btn-xl" disabled={busy || (mode === "create" ? !name.trim() : code.length < 4)}>
          {mode === "create" ? "Crear sala" : "Entrar"}
        </button>
        <p className="muted small center">Sin registro. Mínimo 3 jugadores, desde el celular.</p>
      </form>

      <section aria-labelledby="como" className="steps">
        <h2 id="como" className="h2">Cómo se juega</h2>
        <ol>{STEPS.map(([t, d], i) => <li key={t} style={{ ["--i" as string]: i }}><span className="step-n">{i + 1}</span><div><strong>{t}</strong><p className="muted">{d}</p></div></li>)}</ol>
      </section>
    </main>
  );
}
