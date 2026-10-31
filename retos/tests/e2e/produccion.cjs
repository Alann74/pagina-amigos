// Humo contra el despliegue real (sin endpoint de pruebas): 3 celulares, ronda completa.
// Uso: BASE_URL=https://boca-abajo.vercel.app node tests/e2e/produccion.cjs
const { chromium } = require("playwright");
const fs = require("node:fs"), path = require("node:path");
const BASE = process.env.BASE_URL || "https://boca-abajo.vercel.app";
const SHOTS = process.env.SHOTS || path.join(__dirname, "../../shots-prod"); fs.mkdirSync(SHOTS, { recursive: true });
const NAMES = ["Ana", "Beto", "Cami"]; let bad = 0;
const check = (ok, m) => { console.log(ok ? "  ✔" : "  ✘ FALLA:", m); if (!ok) bad++; };
(async () => {
  const browser = await chromium.launch();
  const o = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "es-AR" };
  const P = {}; for (const n of NAMES) P[n] = await (await browser.newContext(o)).newPage();
  const shot = (n, f) => P[n].screenshot({ path: path.join(SHOTS, f + ".png") });
  const click = async (n, re) => { const b = P[n].getByRole("button", { name: re }).first(); await b.waitFor({ state: "visible", timeout: 20000 }); await b.click(); };
  const see = (n, re) => P[n].getByText(re).first().waitFor({ state: "visible", timeout: 20000 });
  await P.Ana.goto(BASE); await P.Ana.waitForLoadState("networkidle");
  await P.Ana.getByLabel("Tu nombre").fill("Ana"); await P.Ana.getByRole("button", { name: "Crear sala" }).last().click();
  await P.Ana.waitForURL(/\/sala\/[A-Z]{4}/); const code = P.Ana.url().match(/sala\/([A-Z]{4})/)[1]; console.log("sala", code);
  for (const n of NAMES.slice(1)) { await P[n].goto(`${BASE}/sala/${code}`); await P[n].waitForLoadState("networkidle"); await P[n].getByLabel("¿Cómo te llamás?").fill(n); await P[n].getByRole("button", { name: "Entrar a la sala" }).click(); }
  await P.Ana.waitForFunction(() => document.querySelectorAll(".pills li").length === 3); check(true, "3 jugadores entran por enlace y se ven entre sí");
  await shot("Ana", "p1-sala"); await click("Ana", /Empezar la partida/);
  for (const n of NAMES) { await P[n].getByLabel("Escribí tu reto en privado").fill("Reto de " + n + " número uno"); await click(n, /Enviar reto/); }
  await see("Ana", /Reto misterioso/); check(true, "con todos los retos listos se pasa a la votación"); await shot("Beto", "p2-votacion");
  const vote = async (n) => { await P[n].locator("button.card-back").first().click(); await click(n, /Votar la carta 1/); };
  const holderName = async () => (await P.Ana.locator(".face-name").first().innerText()).split(" + ")[0].trim();
  const skip = async () => { for (const n of NAMES) { const b = P[n].locator(".reveal button:not([disabled])"); await b.waitFor({ state: "visible", timeout: 25000 }); await b.click(); } };
  for (let t = 1; t <= 3; t++) {
    await see("Ana", new RegExp(`Reto ${t} de 3`)); for (const n of NAMES) await vote(n);
    await P.Ana.locator(".reveal").waitFor(); if (t === 1) await P.Ana.waitForTimeout(1200), await shot("Ana", "p3-suspenso");
    await skip(); const h = await holderName(); console.log("turno", t, "->", h);
    if (t === 1) { await shot(h, "p4-tu-turno"); await click(h, /Cumplir el reto/); }
    if (t === 2) { await click(h, /Proponer otra prenda/); await P[h].getByLabel("Tu prenda alternativa").fill("Invitar un helado"); await click(h, /^Proponer$/); for (const v of NAMES.filter((x) => x !== h)) await click(v, /Acepto/); }
    if (t === 3) { await click(h, /Retirarme del reto/); await click(h, /Sí, me retiro/); }
    await click("Ana", /Confirmar y seguir/);
  }
  await see("Ana", /Ronda 1 terminada/); await shot("Ana", "p5-resumen");
  check((await P.Ana.locator("table tbody tr").count()) === 3, "ronda de 3 jugadores = 3 retos resueltos y resumen");
  await P.Beto.reload(); await see("Beto", /Ronda 1 terminada/); check(true, "reconexión tras recargar mantiene identidad y partida");
  await click("Ana", /Empezar la ronda 2/); await see("Beto", /Escribí tu reto en privado/); check(true, "nueva ronda pide retos nuevos");
  await browser.close(); console.log(bad ? `${bad} fallas` : "OK"); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error("FALLÓ:", e.message.split("\n")[0]); process.exit(1); });
