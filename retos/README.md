# Boca Abajo — retos entre amigos

Juego de retos para jugar entre amigos desde el celular. Sin registro. Un anfitrión crea una sala privada, los demás entran con un código o enlace, cada uno escribe un reto en privado y se vota a ciegas qué carta se da vuelta.

> Esta app vive en la carpeta `retos/` y es independiente de la tienda que está en la raíz del repo.

## Cómo se juega
1. **Crear la sala** (anfitrión) y compartir el código de 4 letras, el enlace o el QR. Mínimo 3 jugadores.
2. El anfitrión elige si se reparte **1 o 2 comodines en total** (al azar, en privado) y empieza.
3. Cada uno **escribe un reto** en privado. La autoría nunca se muestra.
4. Cada turno tiene **dos votaciones**:
   - **Paso 1, a quién le toca:** una carta numerada por jugador; los nombres están detrás, mezclados en cada turno. Todos **votan un número**. Empate = sorteo entre las cartas empatadas.
   - **Paso 2, qué reto le toca:** cartas de reto boca abajo (nadie sabe quién escribió cada una). Votan todos **menos la persona elegida**. **Nunca sale un reto escrito por ella**: esa carta no existe en el paso 2 (y si solo queda un reto, se asigna directo).
5. **Dos revelaciones** con suspenso, ruleta y giro de carta: primero el nombre, después el reto.
6. El elegido puede **cumplir**, **proponer otra prenda** (todos los demás deben aceptarla; con un solo rechazo vuelve a elegir), **usar un comodín** o **retirarse**. El anfitrión **confirma** antes de avanzar.
7. Con N jugadores, una ronda son N retos resueltos. Al terminar: resumen, un comodín nuevo al azar y nuevos retos.

Comodines: **Pasar el reto** (a alguien que no lo haya tenido en ese turno) y **Rebote** (si te lo pasaron, lo hacen juntos; corta la cadena).

Puntaje: cuentan retos y prendas cumplidas; los retiros se anotan aparte.

## Arquitectura
- **Next.js 16 (App Router) + TypeScript**, CSS propio (sin librerías de UI), fuente Bricolage Grotesque autoalojada.
- **Servidor autoritativo**: `src/lib/engine.ts` (lógica pura) valida turnos, votos, sorteos, pases y comodines. Cada acción lleva la clave del turno (`turnKey`), así que los toques dobles y las jugadas viejas se rechazan.
- **Estado persistente**: una fila por sala en Postgres (`jsonb` + versión). Cada acción es una transacción con `SELECT … FOR UPDATE`. Sin `DATABASE_URL` usa memoria (desarrollo).
- **Tiempo real por sondeo corto** (~1 s) con versión: si no cambió nada, la respuesta es mínima. Funciona en serverless sin WebSockets.
- **Secretos**: `src/lib/view.ts` arma la vista de cada jugador. Antes de revelar no viajan: el reto en juego, qué nombre está detrás de cada carta, los votos ajenos, los comodines ajenos ni la autoría (nunca).
- **Identidad**: token aleatorio en el celular (guardado hasheado en el servidor). Reconexión automática. Desde otro celular se recupera el lugar con el mismo nombre solo si esa persona lleva >15 s desconectada.
- **Texto seguro**: nombres y retos se normalizan (sin caracteres de control/bidi) y React los escapa; no se usa `innerHTML`.

## Correr en local
```bash
cd retos && npm install
npm run dev            # http://localhost:3000 (salas en memoria)
npm run typecheck && npm run test:unit
npm run build && RETOS_TEST_MODE=1 PORT=3100 npm start &   # y en otra terminal:
npm run test:e2e       # partida completa con 4 celulares simulados (Playwright)
```
Producción: definir `DATABASE_URL` (Postgres/Neon). La tabla `rooms` se crea sola. Las salas se borran a los 3 días.

## Decisiones de interpretación (fáciles de cambiar)
- "1 o 2 comodines en total" = en toda la mesa (no por jugador); tipo (Pasar/Rebote) al azar.
- Todos los turnos resueltos cuentan para completar la ronda (incluidos los retiros); en el puntaje solo suman cumplidos y prendas.
- En un reto compartido (rebote) el resultado cuenta para los dos y los dos quedan excluidos de la votación de prendas.
- Quien entra con la ronda empezada mira y se suma en la siguiente.

## Limitaciones de la beta
- Sondeo cada ~1 s (no WebSocket): hay hasta ~1 s de demora entre celulares.
- Si alguien se desconecta, el anfitrión puede cerrar votaciones, saltear al titular o continuar sin esperar retos; no hay temporizadores automáticos.
- Sin parejas, equipos ni retos en cadena (ampliaciones futuras). Sin apuestas ni pagos.
- Los sonidos son sintetizados (WebAudio); en iOS suenan recién después del primer toque.

## Publicar en Vercel
1. Vercel → *Add New → Project* → importar este repo. **Root Directory: `retos`**, framework Next.js.
2. *Settings → Environment Variables*: `DATABASE_URL` (cadena de Neon, región sa-east-1 como `regions: ["gru1"]` de `vercel.json`). No definir `RETOS_TEST_MODE`.
3. *Settings → Deployment Protection*: desactivar Vercel Authentication para que los invitados entren sin cuenta.
4. Deploy. La tabla `rooms` se crea sola en el primer uso.
5. Verificación: `BASE_URL=https://TU-DOMINIO node tests/e2e/partida.cjs` (el escenario con comodines de prueba requiere `RETOS_TEST_MODE=1`; en producción conviene jugar una partida real).
