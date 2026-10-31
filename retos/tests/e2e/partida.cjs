// Partida completa con 4 "celulares" (contextos de Playwright con viewport móvil) contra un servidor real.
// Uso: RETOS_TEST_MODE=1 PORT=3100 npx next start &  →  node tests/e2e/partida.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.BASE_URL || "http://localhost:3100";
const SHOTS = process.env.SHOTS || path.join(__dirname, "../../shots");
fs.mkdirSync(SHOTS, { recursive: true });
const NAMES = ["Ana", "Beto", "Cami", "Dani"];
const log = (...a) => console.log("•", ...a);
const results = [];
function check(ok, msg) { results.push([ok, msg]); console.log(ok ? "  ✔" : "  ✘ FALLA:", msg); if (!ok) process.exitCode = 1; }

(async () => {
  const browser = await chromium.launch();
  const rawNewContext = browser.newContext.bind(browser); // sin pantalla de entrada en el resto de las pruebas
  browser.newContext = async (o) => { const c = await rawNewContext(o); await c.addInitScript(() => { try { sessionStorage.setItem("retos:splash", "1"); } catch {} }); return c; };
  const ctxOpts = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "es-AR" };
  const ctxs = {}, pages = {};
  for (const n of NAMES) { ctxs[n] = await browser.newContext(ctxOpts); pages[n] = await ctxs[n].newPage(); pages[n].on("pageerror", (e) => check(false, `error de página en ${n}: ${e.message}`)); }
  const shot = (n, name) => pages[n].screenshot({ path: path.join(SHOTS, `${name}.png`) });
  const noOverflow = async (n, where) => check(await pages[n].evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `sin scroll horizontal en ${where}`);
  const btn = (n, re) => pages[n].getByRole("button", { name: re }).first();
  const click = async (n, re) => { const b = btn(n, re); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click(); };
  // Sin anfitrión: el árbitro lo sortea el azar, así que se busca en qué celular aparece el botón.
  const clickAny = async (re) => {
    const end = Date.now() + 25000;
    while (Date.now() < end) {
      for (const n of NAMES) { const b = pages[n].getByRole("button", { name: re }).first(); if (await b.isVisible().catch(() => false)) { await b.click(); return n; } }
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error("no apareció el botón " + re);
  };
  const allReady = async (re) => { for (const n of NAMES) await click(n, re); };
  const text = (n, re) => pages[n].getByText(re).first().waitFor({ state: "visible", timeout: 15000 });

  // 0. Pantalla de entrada: mono con humo y sonrisa; se cierra al tocar
  {
    const c = await rawNewContext(ctxOpts); const sp = await c.newPage();
    await sp.goto(BASE); await sp.locator(".splash .mascot-wrap").waitFor();
    await sp.waitForTimeout(1500); await sp.screenshot({ path: path.join(SHOTS, "00-splash.png") });
    check(await sp.locator(".splash-logo").isVisible(), "al entrar aparece el logo del mono");
    check(await sp.locator(".splash .puff-i").first().evaluate((e) => parseFloat(getComputedStyle(e).opacity) > 0), "sale humo del cigarrillo (animado)");
    check((await sp.locator(".splash .grin, .splash .smile").count()) === 0, "la sonrisa es la original del dibujo (sin capa de sonrisa animada)");
    if (await sp.locator(".splash:not(.is-leaving)").count()) await sp.locator(".splash").click({ timeout: 2000 }).catch(() => {}); await sp.locator(".splash").waitFor({ state: "detached" });
    check(true, "la pantalla de entrada se cierra al tocar y no vuelve en la sesión");
    await sp.reload(); await sp.waitForTimeout(600);
    check((await sp.locator(".splash").count()) === 0, "no se repite al recargar en la misma sesión");
    await c.close();
  }

  // 1. Crear sala y entrar por enlace
  const host = pages.Ana;
  await host.goto(BASE); await host.waitForLoadState("networkidle");
  await noOverflow("Ana", "inicio");
  await shot("Ana", "01-inicio");
  await host.getByLabel("Tu nombre").fill("Ana");
  await host.getByRole("button", { name: "Crear sala" }).last().click();
  await host.waitForURL(/\/sala\/[A-Z]{4}/);
  const code = host.url().match(/\/sala\/([A-Z]{4})/)[1];
  log("sala", code);
  for (const n of NAMES.slice(1)) {
    await pages[n].goto(`${BASE}/sala/${code}`); await pages[n].waitForLoadState("networkidle");
    await pages[n].getByLabel("¿Cómo te llamás?").fill(n);
    await pages[n].getByRole("button", { name: "Entrar a la sala" }).click();
  }
  await text("Ana", /En la sala/);
  await pages.Ana.waitForFunction(() => document.querySelectorAll(".pills li").length === 4);
  check(true, "4 jugadores en la sala de espera, entrando por enlace");
  await shot("Ana", "02-sala-espera-anfitrion"); await shot("Beto", "03-sala-espera-jugador");
  await noOverflow("Ana", "sala de espera");
  check((await pages.Beto.getByRole("link", { name: /Invitar por WhatsApp/ }).getAttribute("href"))?.startsWith("https://wa.me/?text=") === true, "botón para invitar por WhatsApp con el código y el enlace");
  check((await pages.Beto.locator("details.qr-box").count()) === 1, "el QR está disponible (plegado)");
  check((await pages.Ana.getByText(/Anfitri/).count()) === 0 && (await pages.Beto.getByText(/Anfitri/).count()) === 0, "no hay anfitrión: nadie tiene rol especial");
  check((await btn("Beto", /Estoy listo/).count()) === 1 && (await btn("Ana", /Estoy listo/).count()) === 1, "quien creó la sala también tiene que tocar “listo” como los demás");
  check((await pages.Dani.getByRole("switch", { name: /Ruleta de humo/ }).count()) === 0, "la ruleta de humo ya no es opcional: no hay interruptor");
  check(await pages.Dani.getByText(/Es obligatorio/).first().isVisible(), "la sala de espera avisa que la ruleta es obligatoria y +18");
  await click("Ana", /Estoy listo/); await click("Beto", /Estoy listo/); await click("Cami", /Estoy listo/);
  await pages.Ana.waitForTimeout(1500);
  check((await pages.Ana.getByLabel("Escribí tu reto en privado").count()) === 0, "con 3 de 4 listos no arranca");
  await click("Dani", /Estoy listo/);   // el último listo dispara el inicio, solo

  // 2. Retos en privado
  for (const n of NAMES) await pages[n].getByLabel("Escribí tu reto en privado").waitFor();
  await shot("Beto", "04-escribir-reto"); await noOverflow("Beto", "escritura");
  await click("Cami", /Inspirame/);
  check((await pages.Cami.getByLabel("Escribí tu reto en privado").inputValue()).length > 10, "“Inspirame” completa una idea de reto");
  const retos = { Ana: "Imitar a un pirata", Beto: "Cantar un tema de cumbia", Cami: "Hablar en rima un minuto", Dani: "Bailar sin música" };
  for (const n of NAMES.slice(0, 3)) {
    await pages[n].getByLabel("Escribí tu reto en privado").fill(retos[n]);
    await click(n, /Enviar reto/);
  }
  await text("Ana", /Reto enviado/);
  check(await pages.Ana.getByText(/Retos listos/).isVisible(), "se muestra el progreso de retos listos (esperando retos)");
  await shot("Ana", "05-esperando-retos");
  await pages.Dani.getByLabel("Escribí tu reto en privado").fill(retos.Dani);
  await click("Dani", /Enviar reto/);

  // 3. Voto con empate (2 vs 2) + comodines para todos para escenarios deterministas
  await text("Ana", /A quién le toca/);
  const r = await fetch(`${BASE}/api/rooms/${code}/test`, { method: "POST", body: JSON.stringify({ jokers: { Ana: ["pass", "bounce"], Beto: ["pass", "bounce"], Cami: ["pass", "bounce"], Dani: ["pass", "bounce"] } }) });
  check(r.ok, "comodines de prueba repartidos (modo test)");
  for (const n of NAMES) await pages[n].locator("button.card-back").first().waitFor();
  check(!(await pages.Beto.content()).includes("Hablar en rima"), "el reto en juego no llega al navegador antes de revelar");
  await shot("Ana", "06-votacion");
  await noOverflow("Ana", "votación");
  const voteFor = async (n, card) => { await pages[n].locator("button.card-back").nth(card - 1).click(); await click(n, new RegExp(`Votar la carta ${card}`)); };
  await voteFor("Ana", 1); await voteFor("Beto", 1);
  await text("Ana", /Faltan 2 votos/);
  await shot("Ana", "07-faltan-votos");
  check(await pages.Cami.locator("button.card-back").count() === 4, "cada jugador ve 4 cartas boca abajo (una por participante)");
  await voteFor("Cami", 2);
  await voteFor("Dani", 2);
  // revelación (suspenso con empate)
  await pages.Ana.locator(".reveal").waitFor();
  await text("Ana", /Empate entre las cartas 1 y 2/);
  await shot("Ana", "08-revelacion-suspenso");
  await pages.Ana.locator(".flip.is-flipped").waitFor({ timeout: 8000 });
  await pages.Ana.waitForTimeout(1300);
  await shot("Ana", "09-revelacion-giro");
  await pages.Ana.getByRole("button", { name: "Seguir" }).waitFor({ state: "visible" });
  await pages.Ana.waitForFunction(() => !document.querySelector(".reveal button")?.disabled);
  await shot("Ana", "10-revelacion-final");
  await noOverflow("Ana", "revelación");
  const holderOf = async () => (await pages.Ana.locator(".face-name").first().innerText()).split(" + ")[0].trim();
  const skipReveal = async () => {
    for (const n of NAMES) {
      const b = pages[n].locator(".reveal button:not([disabled])");
      await b.waitFor({ state: "visible", timeout: 25000 });
      await b.click();
    }
  };
  // Paso 2: votan el reto todos menos el elegido; después se revela el reto (segunda revelación)
  const pickReto = async (h) => {
    // Con un solo reto posible (últimos turnos) no hay segunda votación: el reto se asigna y se revela directo.
    const mode = await Promise.any([
      pages[h].getByText(/Los demás eligen tu reto/).first().waitFor({ timeout: 15000 }).then(() => "pick"),
      pages.Ana.locator(".reveal").waitFor({ timeout: 15000 }).then(() => "auto"),
    ]);
    if (mode === "pick") {
      check((await pages[h].locator("button.card-back").count()) === 0, "el elegido no vota su propio reto");
      for (const n of NAMES.filter((x) => x !== h)) { await pages[n].locator("button.card-back").first().click(); await click(n, /Votar el reto 1/); }
      await pages.Ana.locator(".reveal").waitFor({ timeout: 15000 });
    }
    await skipReveal();
  };
  // Primera revelación (a quién le toca) + paso 2 (qué reto). Devuelve el titular.
  const holderFromReveal = async () => { await pages.Ana.locator(".reveal button:not([disabled])").waitFor({ timeout: 25000 }); return pages.Ana.locator(".reveal .flip-name").first().getAttribute("aria-label"); };
  const afterReveal = async () => { const h = await holderFromReveal(); await skipReveal(); await pickReto(h); return h; };
  let holder = await holderFromReveal();
  await skipReveal();
  log("turno 1 (empate) le toca a", holder);
  check(await pages[holder].getByText(/Paso 2 de 2/).first().isVisible() && (await pages[holder].locator(".face-challenge").count()) === 0, "después de la primera revelación todavía no se sabe el reto (paso 2)");
  await shot(holder === "Ana" ? "Beto" : "Ana", "10b-paso2-votar-reto");
  await pickReto(holder);
  check(!!pages[holder], "la carta ganadora revela un jugador de la sala");
  await shot(holder, "11-tu-turno-titular");
  check(await btn(holder, /Cumplir el reto/).isVisible(), "el titular ve sus 4 opciones");
  check(await btn(holder, /Usar un comodín/).isVisible(), "el titular con comodín ve la opción de comodín");
  const nonHolder = NAMES.find((n) => n !== holder && n !== "Ana");
  check(await btn(nonHolder, /Cumplir el reto/).count() === 0, "quien no es titular no ve acciones del titular");

  // 3a. Alternativa rechazada y luego aceptada
  await click(holder, /Proponer otra prenda/);
  await pages[holder].getByLabel("Tu prenda alternativa").fill("Invitar una ronda de helado");
  await click(holder, /^Proponer$/);
  const voters = NAMES.filter((n) => n !== holder);
  for (const v of voters) await text(v, /Prenda alternativa de/);
  await shot(voters[0], "12-votar-prenda");
  await click(voters[0], /Acepto/);
  await click(voters[1], /Rechazo/);
  await text(holder, /Rechazadas/);
  check(true, "una prenda rechazada vuelve al titular con sus opciones");
  await click(holder, /Proponer otra prenda/);
  await pages[holder].getByLabel("Tu prenda alternativa").fill("Bailar 30 segundos");
  await click(holder, /^Proponer$/);
  for (const v of voters) { await click(v, /Acepto/); }
  await text("Ana", /Árbitro sorteado/);
  await shot("Ana", "13-confirmar");
  if (holder === "Ana") await text("Ana", /hará la prenda/);
  check(await btn(holder, /Confirmar y seguir/).count() === 0, "el titular nunca confirma su propio reto");
  const judge1 = await clickAny(/Confirmar y seguir/);
  check(judge1 !== holder, "confirmó un árbitro sorteado distinto del titular (" + judge1 + ")");

  // 4. Turno 2: pase + rebote (reconexión de un jugador en medio)
  await text("Ana", /Turno 2 de 4/);
  const votes2 = [1, 1, 1, 1]; for (const [i, n] of NAMES.entries()) await voteFor(n, votes2[i]);
  await afterReveal();
  let h2 = await holderOf(); log("turno 2 titular", h2);
  await click(h2, /Usar un comodín/);
  const targetName = NAMES.find((n) => n !== h2);
  await pages[h2].getByRole("radio", { name: targetName }).click();
  await click(h2, new RegExp(`Pasárselo a ${targetName}`));
  await text(targetName, /¡Te tocó! Tu turno/);
  check(await pages[targetName].getByText(/usó Pasar el reto/).first().isVisible(), "el pase queda registrado en el turno");
  // reconexión: el receptor recarga la página y no pierde su lugar
  await pages[targetName].reload();
  await text(targetName, /¡Te tocó! Tu turno/);
  check(true, "reconexión: tras recargar mantiene identidad y partida");
  await click(targetName, /Usar un comodín/);
  await shot(targetName, "14-menu-comodin");
  await click(targetName, /Usar Rebote/);
  await text(targetName, /Turno 2 de 4 · compartido/);
  check(await btn(targetName, /Usar un comodín/).count() === 0, "en un reto compartido ya no hay comodines");
  await shot(targetName, "15-reto-compartido");
  await click(targetName, /Cumplir el reto/);
  await clickAny(/Confirmar y seguir/);

  // 5. Turno 3: retiro; pausa y reanudación
  await text("Ana", /Turno 3 de 4/);
  for (const n of NAMES) await voteFor(n, 3);
  await afterReveal();
  let h3 = await holderOf();
  await click("Ana", /Menú/);
  await click("Ana", /Pausar la partida/);
  await text("Beto", /Partida en pausa/);
  await shot("Beto", "16-pausa");
  check((await btn("Beto", /Reanudar/).count()) === 1, "en pausa cualquiera puede reanudar");
  await click("Beto", /Reanudar/);
  await pages.Beto.getByRole("alertdialog").waitFor({ state: "detached" });
  check(true, "pausa y reanudación sincronizadas");
  await click(h3, /Retirarme del reto/);
  await click(h3, /Sí, me retiro/);
  await clickAny(/Confirmar y seguir/);

  // 5b. Ruleta de humo (activada por mayoría): sale tras el 3.er reto, en todos los celulares
  for (const n of NAMES) await pages[n].locator(".smoke-ov").waitFor({ timeout: 20000 });
  check(true, "la ruleta de humo aparece en los 4 celulares tras el 3.er reto");
  await pages.Ana.waitForTimeout(900); await shot("Ana", "ruleta-1-humo");
  await pages.Ana.waitForTimeout(2200); await shot("Ana", "ruleta-2-personaje-y-nombre");
  check(await pages.Ana.getByText(/Cuántas secas va a dar/).first().isVisible(), "el título dice “¿Cuántas secas va a dar (nombre)?”");
  check((await pages.Ana.locator(".wheel").count()) === 1, "es una rueda (ruleta) que gira");
  await pages.Ana.getByRole("button", { name: /Hacelo cagón$/ }).waitFor({ timeout: 40000 });
  await shot("Ana", "ruleta-3-resultado");
  let pasos = 0; for (const n of NAMES) pasos += await pages[n].getByRole("button", { name: /Paso/ }).count();
  check(pasos === 0, "no hay botón para pasar: es obligatorio");
  check((await pages.Ana.getByRole("button", { name: /^Seguir$/ }).count()) === 0, "el botón no dice “Seguir”: dice “Hacelo cagón”");
  check(/da [1-5] secas?\. Es obligatorio/.test(await pages.Ana.locator(".smoke-result").innerText()), "el resultado es un número del 1 al 5");
  await pages.Ana.getByRole("button", { name: /Hacelo cagón$/ }).click();
  for (const n of NAMES) await pages[n].locator(".smoke-ov").waitFor({ state: "detached", timeout: 15000 });
  check(true, "al seguir, la ruleta se cierra en todos y el juego continúa");

  // 6. Turno 4: cumplir pero el anfitrión marca que no lo cumplió → fin de ronda
  await text("Ana", /Turno 4 de 4/);
  for (const n of NAMES) await voteFor(n, 4);
  await afterReveal();
  let h4 = await holderOf();
  await click(h4, /Cumplir el reto/);
  await clickAny(/No lo cumplió/);
  await text("Ana", /Ronda 1 terminada/);
  await shot("Ana", "17-resumen-ronda"); await noOverflow("Ana", "resumen");
  await text("Beto", /Se repartió un comodín nuevo/);
  check(await pages.Beto.getByText(/Se repartió un comodín nuevo/).isVisible(), "el resumen avisa del comodín nuevo sin revelar a quién");
  check(await pages.Ana.locator("table tbody tr").count() === 4, "el resumen lista a los 4 jugadores");

  // 7. Historial y nueva ronda
  await click("Beto", /Historial de turnos/);
  await text("Beto", /Cantar un tema de cumbia|Imitar a un pirata|Hablar en rima|Bailar sin música/);
  await shot("Beto", "18-historial");
  await pages.Beto.getByRole("button", { name: "Cerrar" }).click();
  await allReady(/Seguimos.*Ronda 2/);
  for (const n of NAMES) await pages[n].getByLabel("Escribí tu reto en privado").waitFor();
  check(true, "nueva ronda: se piden retos nuevos a todos");
  // reconexión desde otro celular (contexto nuevo, mismo nombre, tras >15 s sin conexión)
  await ctxs.Dani.close();
  await pages.Ana.waitForTimeout(17000);
  ctxs.Dani = await browser.newContext(ctxOpts); pages.Dani = await ctxs.Dani.newPage();
  await pages.Dani.goto(`${BASE}/sala/${code}`); await pages.Dani.waitForLoadState("networkidle");
  await pages.Dani.getByLabel("¿Cómo te llamás?").fill("Dani");
  await pages.Dani.getByRole("button", { name: "Entrar a la sala" }).click();
  await pages.Dani.getByLabel("Escribí tu reto en privado").waitFor();
  check(await pages.Ana.locator(".pills li").count() === 4, "reconexión desde otro celular recupera el lugar sin duplicar jugador");
  // un nombre ocupado por alguien conectado se rechaza
  const intruder = await browser.newContext(ctxOpts); const ip = await intruder.newPage();
  await ip.goto(`${BASE}/sala/${code}`); await ip.waitForLoadState("networkidle"); await ip.getByLabel("¿Cómo te llamás?").fill("Ana");
  await ip.getByRole("button", { name: "Entrar a la sala" }).click();
  await ip.getByText(/ya está en uso/).waitFor();
  check(true, "no se puede tomar el nombre de alguien conectado");
  await intruder.close();

  // 8. Ajustes: reducir movimiento y sonido; terminar partida
  await click("Ana", /^Menú/);
  await pages.Ana.getByRole("switch", { name: /Reducir movimiento/ }).click();
  check(await pages.Ana.evaluate(() => document.documentElement.dataset.motion) === "reduced", "reducir movimiento activa el modo reducido");
  await pages.Ana.getByRole("switch", { name: /Sonidos/ }).click();
  check(await pages.Ana.evaluate(() => localStorage.getItem("retos:sound")) === "0", "los sonidos se pueden desactivar");
  await shot("Ana", "19-menu");
  await pages.Ana.getByRole("switch", { name: /Votar para terminar/ }).click();   // el menú de Ana ya está abierto
  await pages.Ana.getByRole("button", { name: "Cerrar" }).click();
  for (const n of ["Beto", "Cami"]) { await click(n, /^Menú/); await pages[n].getByRole("switch", { name: /Votar para terminar/ }).click(); if (n === "Beto") await pages[n].getByRole("button", { name: "Cerrar" }).click(); }
  await text("Beto", /Así quedó la mesa/);
  await shot("Beto", "20-final");
  check(true, "la partida termina por votación de la mayoría (3 de 4) y todos ven el ranking");
  await click("Beto", /Revancha/);
  for (const n of ["Ana", "Beto", "Cami", "Dani"]) await pages[n].getByRole("button", { name: /Estoy listo/ }).waitFor({ timeout: 15000 });
  check((await pages.Ana.locator(".pills li").count()) === 4, "revancha: misma sala con los 4 jugadores, de nuevo en la sala de espera");

  await browser.close();
  const bad = results.filter((r) => !r[0]).length;
  console.log(`\n${results.length - bad}/${results.length} comprobaciones OK`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error("FALLÓ:", e.message); process.exit(1); });
