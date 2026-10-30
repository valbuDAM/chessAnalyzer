# Roadmap — Zugzwang

▶ Siguiente tarea: T4.5 (sonnet · high · advisor sí: `/effort high` y `/advisor opus`)

## Notas de traspaso (tarea en curso)

> Lo primero que se lee tras un `/clear`. Se reescribe al cerrar o pausar cada tarea.

- **Tarea anterior:** T4.4 cerrada (PR #66, ya mergeado).
- **Entregado en T4.4:**
  - `MoveList`: cada jugada es un `Move` memoizado (una puntuación nueva repinta solo su jugada); el scroll a la jugada actual se difiere un frame (`scrollSoon`) porque leer `offsetTop` en el handler de teclado forzaba un layout de la lista entera (20–115 ms por paso con 300 jugadas).
  - Tests: unitario del agrupado (`formatEval` se llama 1 vez, no 3) y e2e de long tasks con 300 jugadas en Chromium.
- **Límites de T4.4:** el e2e tolera tareas de hasta 100 ms, no 50 (el API mide desde 50 y los runners oscilan; `shortcut:` en el test); no se mide en móvil ni en Firefox/WebKit; `content-visibility` se probó y se descartó (rompe el scroll exacto). El análisis ya notificaba una vez por posición, así que no hizo falta agrupar más en `analyseGame`.
- **Tarea anterior:** T4.3 cerrada (PR #64, ya mergeado).
- **Entregado en T4.3:**
  - `src/domain/analysisCache.ts`: `readAnalysis` / `writeAnalysis` sobre `idb-keyval`. Clave `analysis:v1:<variante>:<profundidad>:<sha256 de los FEN>` (no del PGN: el análisis solo depende de las posiciones). Una entrada con otra longitud que la partida se ignora. Si IndexedDB o `crypto.subtle` fallan, se sigue sin caché.
  - `GameViewer` lee la caché al montar (solo aplica el resultado si el estado sigue `idle`) y guarda al terminar un análisis completo; los cancelados no se guardan.
  - Tests: unitarios de la caché, tres de componente y un e2e que analiza, recarga y comprueba que no se pide el motor. Sin dependencias nuevas (`fake-indexeddb` ya estaba por T2.2).
- **Límites de T4.3:** los 300 ms de la aceptación no se midieron (el e2e solo comprueba que no se pide el motor); e2e Firefox/WebKit sin ejecutar; las entradas no se expulsan nunca (`shortcut:`); al cambiar la forma de `WhiteScore` hay que subir `v1` a mano; solo se valida la longitud de lo leído.
- **Tarea anterior:** T4.2 cerrada (PR #62, ya mergeado). Detalle en ADR-028.
- **Entregado en T4.2:**
  - `src/domain/engine/settings.ts`: `analysisSettings` + `uciOptions` (ADR-009). `createEngine.ts`: `detectSettings()`; `createEngine` pasa las opciones a `UciEngine({ options })`.
  - `parseInfo` lee `multipv`; `UciEngine` solo guarda la línea 1. Test del `stop()` entre `ucinewgame` y `go` (pendiente de M2).
  - `analyseGame` con `signal` y `onProgress(scores)`; `GameViewer` (envoltorio `key={pgn}`) muestra lo analizado mientras sigue. `FakeEngine` con `latency`.
  - `engine-check` con botón «Detener» y e2e de cancelación con el motor real. CI: `vendor-engine.mjs --check`.
- **Límites de T4.2:** sin botón de detener; `Eval` sin segunda línea de MultiPV; `ucinewgame` en cada posición vacía el hash (se podría conservar dentro de una partida); profundidad 16 con hilos sin medir en un equipo modesto; e2e Firefox/WebKit sin ejecutar.
- **Tests intermitentes corregidos en T4.2:** el `requestAnimationFrame` de jsdom sella con un reloj que arranca con el entorno y chessground lo compara con `performance.now()`: cada animación duraba lo que tardó ese arranque (1,3 s; más de 10 s con la CPU cargada). `src/test-setup.ts` sella con `performance.now()`. `testTimeout` global de 15 s por el mismo motivo de CPU.
- **Tarea anterior:** T4.1 cerrada (PR #60, ya mergeado).
- **Entregado en T4.1:**
  - `src/domain/engine/variant.ts`: `selectVariant({ wasm, threads })` → `lite-multi` | `lite-single` | `asm`, y `VARIANT_FILES`. `detectVariant()` (en `createEngine.ts`) lee `crossOriginIsolated`, `SharedArrayBuffer` y `WebAssembly`; `createEngine(variant?)` carga el Worker de esa variante.
  - `UciEngine(transport, { startTimeout = 10_000 })`: el temporizador solo cubre el handshake. `EngineLoadError` (subclase de `EngineError`, mismo `name`) para timeout y para errores del Worker antes de `ready`; `GameViewer` lo distingue y muestra «No se pudo cargar el motor».
  - `GameViewer` recibe `variant` y pinta un `<details class="game-viewer-about">` «Acerca del análisis» con la variante.
  - e2e en `analysis.spec.ts`: una prueba por rama (qué script de Worker se pide) y un Worker mudo que acaba en el aviso a los 10 s. Para ocultar globales se usa `Object.defineProperty`: `delete window.X` no hace nada en el proyecto móvil (Pixel 7).
- **Límites de T4.1:** si el multihilo no carga no se reintenta con el de un hilo (el roadmap solo pide aviso); `new Worker` que lanza síncrono sale como «No se pudo analizar» en vez de «No se pudo cargar el motor»; el multihilo corre con 1 hilo hasta T4.2; e2e Firefox/WebKit sin ejecutar.
- **Pendiente de la usuaria (cierre de M3):** e2e Firefox/WebKit (job manual) y `/usage`. Cierre de M3: `mutate` 85,78 % en `src/domain/` (`chesscom.ts` 78,7 % y `UciEngine.ts` 81 % los más flojos); `ponytail-debt` sin marcadores sin trigger salvo `sound.ts:41` (aceptado).
- **Tarea anterior:** T3.4 cerrada (PR #57, ya mergeado y probado en un móvil real).
- **Entregado en T3.4:**
  - Token `--target-touch` (44 px) en `tokens.css`; botones del visor y de la lista lo usan con `max-width: 40rem` o `pointer: coarse`. En móvil `.game-summary` reduce su padding lateral para que el tablero ocupe el ancho.
  - La lista de jugadas va en un `<details class="game-viewer-moves">`: cerrado por defecto en ≤ 40rem (se lee una vez con `matchMedia`), abierto en escritorio. Al abrirlo, `onToggle` reutiliza `scrollToView` (exportada de `MoveList`) para mostrar la jugada actual.
  - `tests/e2e/mobile.spec.ts` (375×812 + axe); `analysis.spec.ts` abre el panel con `openMoves` porque en el proyecto móvil empieza cerrado.
- **Límites de T3.4:** sin captura de pantalla ni revisión con el viewport en horizontal; el plegado no reacciona a un cambio de tamaño de ventana después de cargar.
- **Tarea anterior:** T3.3 cerrada (PR #55, ya mergeado).
- **Entregado en T3.3:**
  - `src/ui/sound.ts`: sonidos sintetizados con Web Audio (sin archivos, nada que licenciar), `soundKind(san, isLast)` (fin > jaque > captura > jugada), `readMuted`/`storeMuted` (`localStorage`; sin elección guardada, `prefers-reduced-motion` silencia). Botón «Sonidos» (`aria-pressed`) en los controles del visor; un efecto en `GameViewer` suena al cambiar de jugada.
  - Los controles ahora hacen `flex-wrap`: con cuatro botones desbordaban a 375 px y rompían el e2e móvil (relevante para T3.4).
- **Límites de T3.3:** timbres no escuchados ni ajustados; audio no probado en un navegador real (los tests simulan `playSound`); `shortcut:` si el almacenamiento está bloqueado la elección no sobrevive a la recarga.
- **Tarea anterior:** T3.2 cerrada (PR #53, ya mergeado).
- **Entregado en T3.2:**
  - `GameViewer`: un listener `keydown` en `window` (←/→, Inicio/Fin, `F`; ignora Ctrl/Alt/Meta y campos de texto) y botón «Girar tablero» (`aria-pressed`). El giro se suma a la prop `orientation` y llega también a la `EvalBar`.
  - El `role="status"` tiene el texto visible con `aria-hidden` y un `.sr-only` (en `base.css`) con el anuncio «2. Cf3, blancas» / «Posición inicial». Las letras de pieza van en español solo en el anuncio (`game.pieceLetters` = `RDTAC`); la lista de jugadas sigue en notación inglesa.
- **Límites de T3.2:** no se ha probado con un lector de pantalla real; los tests no comprueban que el tablero gire de verdad (solo `aria-pressed`); el giro no se anuncia ni se guarda entre partidas.
- **Tarea anterior:** T3.1 cerrada (PR #50, ya mergeado).
- **Entregado en T3.1:**
  - `MoveList` (`src/ui/MoveList.tsx`) sustituye a la lista de evaluaciones de `GameViewer`: pares numerados, cada jugada es un botón (`onSelect(ply)`), `aria-current="step"` en la actual, reloj `[%clk]` (`formatClock` en `src/i18n/format.ts`) y evaluación una vez analizada. Clave i18n `game.evalList` → `game.moves`.
  - El scroll mueve solo la lista (`scrollTop` desde `offsetTop`), con la función de ref estable a nivel de módulo; con `scrollIntoView` la página saltaba en cada render. En jsdom no hace nada: lo cubre un e2e con 36 jugadas.
- **Límites de T3.1:** falta el encabezado con la apertura (M5). No se ha visto en tema claro ni en móvil real, ni con 100+ jugadas; el contraste usa `--color-on-felt-muted` (el número de jugada falló axe con `--color-text-muted`). El test de la captura de peón en `GameViewer.test.tsx` falló una vez por timeout de animación.
- **Tarea anterior:** T2.6 cerrada (PR #47, ya mergeado). M2 completo salvo su checklist de cierre.
- **Entregado en T2.6** (ADR-027):
  - `isStandard(variant)` en `src/domain/pgn.ts` (lista blanca) y `Game.variant` (`rules` de la API o cabecera `Variant` del PGN). Clave de caché `games:v2:<url>`.
  - `parseGamePgn` lanza `PgnError({ kind: 'variant', name })`; la rama Chess960 se borró. `PastePgn` lo muestra en `role="alert"`.
  - `GameCard`: «No compatible» en la línea de meta, sigue enlazando. `GamePage`: explicación en `role="alert"` en vez de `GameViewer`. `variantName` traduce `chess960`, `crazyhouse`, `bughouse`, `kingofthehill` y `threecheck`; el resto muestra el nombre tal cual.
- **Límites de T2.6:** los nombres de `rules`/`Variant` de chess.com son de memoria, no de respuestas reales. No se ha comprobado el contraste del texto rojo «No compatible» en la lista (axe solo pasa por la página de la partida) ni en tema claro o móvil real. Un `[Variant ""]` da un mensaje con el nombre vacío.
- **Tarea anterior:** T2.5 cerrada (PR #45, ya mergeado).
- **Entregado en T2.5:**
  - `src/domain/pgn.ts`: `PgnError(problem)` con `PgnProblem = empty | setup | illegal {number, black, san}` (el número sale de `pos.fullmoves`, así que cuenta bien desde una FEN) y `readPgn(text)` → `PgnGame[]` (`pgn` de cada partida con `makePgn`, jugadores, resultado, fecha). Solo cuenta las partidas con jugadas. `parseGamePgn` lanza `PgnError`.
  - `PastePgn` (en `Home`): un único formulario. Con una partida la abre; con varias muestra radios y «Analizar esta partida». Solo valida la elegida. Error en `role="alert"` bajo el área de texto: «Jugada ilegal en 12. Qe5» / «12… Nf6».
  - `/pgn` (`PastedGamePage`) lee la partida de una variable de módulo o de `sessionStorage` (por si el navegador bloquea el almacenamiento); sin nada, vuelve a `/`. Blancas siempre abajo.
- **Límites de T2.5:** sin subir ni arrastrar `.pgn`; lista sin paginar (`shortcut:`); con almacenamiento bloqueado la partida se pierde al recargar; el error no dice de qué partida es; no se ha visto en móvil real ni en tema claro.- **Tarea anterior:** T2.4 cerrada (PR #42 y #43).
- **Entregado en T2.4:**
  - `src/domain/games.ts`: `parseQuery`/`buildQuery` (`?tc=&color=&result=&month=YYYY-MM&months=N`, un valor por filtro, los desconocidos se ignoran) y `filterGames`. `UserPage` guarda ese estado en la URL con `replaceState`; la tarjeta y `GamePage` lo devuelven entero al volver.
  - Selector de mes con todos los meses de `getArchives`: elegir uno carga solo ese mes y «Cargar mes anterior» sigue hacia atrás desde él. Un `?month=` que el usuario no jugó se descarta. `Filters` va montado aunque cargue otro mes (`archives` aparte del `state`) para no perder el foco.
  - Contador «X de Y partidas» sobre los meses cargados; sin resultados, estado vacío y «Quitar filtros» (quita también el mes). Primer test de componente de `UserPage` y dos e2e.
- **Límites de T2.4:** el filtro solo ve los meses cargados (no busca en los demás). Los selectores son `<select>` nativos con estilo mínimo; no se ha revisado con axe el tema claro ni su aspecto en móvil real. Con filtros activos «Cargar mes anterior» sigue visible aunque el mes cargado no tenga coincidencias.
- **Entregado en T2.3:**
  - `/u/:user` (`UserPage`, con `key={user}`) es la lista: carga el mes más reciente y «Cargar mes anterior» añade el siguiente hacia atrás. Lleva el foco al encabezado del mes nuevo y guarda la cuenta en `?months=N` (`history.replaceState`), que se relee al entrar. La tarjeta lleva el mismo `?months` en su enlace y `GamePage` lo devuelve en «Volver a sus partidas».
  - `src/domain/games.ts` (puro): `gameId` (último segmento de la URL), `moveCount` (regex sobre el PGN; `shortcut:` con variantes), `playerView` (color, rival y resultado desde el usuario, sin distinguir mayúsculas), `monthStart` (UTC desde `…/YYYY/MM`) y `addMonth` (más nueva primero, sin repetir `url` de meses anteriores). `formatMonth` en `src/i18n/format.ts`.
  - `GameCard`: un `<Link>` por tarjeta. Puntuación 1 · ½ · 0 en Young Serif con la palabra debajo, filete izquierdo por resultado (`--color-label-best` / `-mistake` / `--color-text-muted`), rival y Elo, ritmo, color con una ficha de color, jugadas y fecha. Lleva espacios explícitos entre las partes para que el nombre accesible se lea bien.
  - `/u/:user/:gameId` (`GamePage`): `findGame(user, id)` (sustituye a `getLastGame`) busca mes a mes desde el más reciente. Cabecera «X contra Y» y `GameViewer` con `orientation` = color del usuario, que pasa a `Board` (chessground `orientation`) y a `EvalBar` (`data-orientation`; el número sigue desde blancas).
  - **Mes no disponible:** `getMonthGames` devuelve `null`, sin guardarlo en caché, si chess.com responde 404 a un mes que sí lista (pasa con el mes en curso de `hikaru`, que es enorme). La lista lo marca y deja seguir. `Month.games` es `Game[] | null`.
  - **Rendimiento** (Chromium headless, 500 tarjetas sintéticas): 383 ms de tarea larga al pintar, que bajan a 204 ms con `content-visibility: auto` en `.month-games > li`. Al desplazar, 18 ms por frame. Sin virtualización. Un usuario real (danielnaroditsky) tiene 935 partidas en un mes.
  - La home dice «Ver partidas». `.page a` pasa a `.page > a` para que las tarjetas no hereden el latón.
- **Límites de T2.3:** un error de red al cargar los N meses iniciales tumba toda la página (el reintento recarga todo). Un enlace directo a una partida de un mes con 404 dice «no hay ninguna partida» en vez de «no disponible». No se ha comprobado con axe el tema claro de las tarjetas, ni la barra girada en un navegador real (solo su CSS). Un solo PR de 428 líneas, unas 150 de CSS, aceptado por la usuaria.
- **Entregado en T2.2:**
  - `getMonthGames(url)` en `src/domain/chesscom.ts` guarda el `Game[]` ya validado de los meses cerrados en IndexedDB (`idb-keyval`, clave `games:v1:<url>`, hoy `v2`) y lo devuelve sin red la siguiente vez. Un mes está cerrado cuando han pasado 24 h desde el inicio del mes siguiente en UTC, para dar margen a las partidas indexadas tarde. El mes en curso no cambia: lo cubre la caché HTTP del navegador (ADR).
  - Si IndexedDB falla al leer o escribir (cuota llena, bloqueado, no disponible), el error se ignora y se descarga. La lectura de la caché va fuera de la cola en serie.
  - Tests: unitarios con `fake-indexeddb` (una sola descarga, límite exacto de 24 h, fallos de IDB, con `get`/`set` espiados por `vi.mock`) y e2e en `home.spec.ts` que recarga y cuenta 1 petición. Comprobado también en el navegador con la API real: un mes cerrado de `erik` hace 0 peticiones tras recargar.
- **Límites de T2.2:** las claves de versiones antiguas no se borran nunca (`shortcut:`). Si el reloj del cliente va más de 24 h adelantado, el mes en curso se guardaría incompleto (riesgo aceptado). Los datos leídos de IDB solo se comprueban con `Array.isArray`. Al cambiar el tipo `Game`, hay que subir la versión de la clave a mano.
- **Entregado en T2.1** (PR #34):
  - `src/domain/chesscom.ts`: `ChessComError(message, kind = 'shape', status?)` con `ErrorKind = notFound | rateLimit | offline | timeout | http | shape`. `fetchOk` reintenta el 429 hasta 3 veces (1 s, 2 s, 4 s) dentro de la cola en serie, aplica timeout de 15 s (`AbortSignal.timeout`, que también cubre la descarga del cuerpo) y trata `navigator.onLine === false` y los fallos de `fetch` como `offline`. `getPlayer(user)` y `normalizeUser(user)` (recortar y minúsculas) nuevos; `getArchives` usa `normalizeUser`.
  - `src/ui/ApiError.tsx`: `role="alert"` con el mensaje de `error.<kind>` y «Reintentar» salvo en `notFound` y `shape`. Lo usan `Home` (que valida con `getPlayer` antes de navegar, así el campo conserva el texto) y `UserPage` (reintenta con un contador `attempt`).
  - e2e: usuario inexistente con axe en `home.spec.ts`; `home` y `analysis` interceptan también `GET /player/{user}`.
- **Límites de T2.1:** no se lee `Retry-After`, la espera es fija y exponencial. Un enlace directo `/u/x` a un usuario inexistente se detecta por el 404 de los archivos, sin pedir el perfil. El error de `Home` no se borra al editar el campo, solo al reenviar. No hay e2e del 429 ni del modo sin conexión (cubiertos en unitarios). Los tests de `App` usan `mockRejectedValueOnce`: el `mockRejectedValue` persistente daba un rechazo no manejado en vitest.
- **Antes, T1.5:** cerrada (PR #32); M1 completo salvo su checklist de cierre.
- **Entregado en T1.5** (ADR-026):
  - `src/domain/analysis.ts`: `analyseGame(engine, fens, { depth, onProgress })` → `WhiteScore[]` (punto de vista de blancas, N+1 posiciones, en serie); `winPercent(score)` con la fórmula de ADR-011 (T5.1 la reutiliza y añade la precisión); `ANALYSIS_DEPTH = 10`; `FinalScore = {kind:'final', winner}` para mate/ahogado/material insuficiente, que no se mandan al motor.
  - `formatEval` en `src/i18n/format.ts` («+0,3», «-#2», «1-0», «½-½»).
  - `GameViewer` acepta `makeEngine` (por defecto `createEngine`): botón «Analizar», `<progress>` nativo, `EvalBar` que sigue a la jugada y lista `<ol>` de evaluaciones. El motor se crea al pulsar y se libera al terminar, al fallar y al desmontar.
- **Límites de T1.5:** sin cancelar, sin selector de profundidad, la lista no salta a la jugada al pulsarla, no se guarda el análisis (se pierde al salir; caché en T4.3). Una partida de ~140 jugadas a profundidad 10 con el lite de un hilo puede pasar de un minuto. `GameViewer` no se reinicia si cambia la prop `pgn` (hoy se desmonta al cambiar de usuario).
- **⚠ Criterio sin cumplir:** «el flujo completo funciona en la previsualización desplegada» (T1.5) se comprobó con `vite preview` local y API simulada, porque las previews de Cloudflare siguen apagadas (ver la deuda aceptada más abajo). Tampoco se ha comprobado que Cloudflare sirva el `.wasm` como `application/wasm` en producción: mirar `/engine/stockfish-19-lite-single.wasm` en la URL de producción tras el siguiente despliegue.
- **Entregado en T1.4** (decisiones en ADR-025):
  - `src/domain/engine/`: `Engine { analyse(fen, opts?) → Promise<Eval>; stop(); dispose() }`, `Eval = { score, bestMove, depth, pv }`, `Score = {kind:'cp',cp} | {kind:'mate',mate}` **desde el punto de vista del bando que mueve** (T1.5 y la precisión tienen que pasarlo a blancas), `DEFAULT_DEPTH = 12`, `EngineError` y `AbortError`. `UciEngine` lleva todo el protocolo sobre un `Transport` inyectable; `FakeEngine(evals por FEN)` para los tests de consumidores.
  - `src/engine/createEngine.ts`: único código de navegador; `createEngine()` crea el Worker de `public/engine/stockfish-19-lite-single.js` **al instanciarse** (el handshake sí es perezoso). Quien lo cree debe llamar a `dispose()` al desmontar.
  - `scripts/vendor-engine.mjs` (`npm run vendor:engine`): Stockfish 19.0.1 de unpkg a `public/engine/` (lite de un hilo, lite multihilo, asm.js, `COPYING.txt`, `SOURCE.txt`), hashes SHA-256 fijados en el primer uso, idempotente, excluido de Biome.
  - `engine-check.html` (+ `src/engine/check.tsx`): página sin enlazar y `noindex` que ejecuta el motor real; la usa `tests/e2e/engine.spec.ts` (2 criterios de aceptación, `application/wasm`, UI viva, axe). Sin i18n a propósito.
- **Límites de T1.4:** solo se carga el lite de un hilo; multihilo y asm.js están vendorizados pero sin usar (selector de variante en una tarea posterior, ADR-008). Sin `onProgress`, `MultiPV`, reinicio del Worker ni timeout de arranque; solo ajedrez estándar (`// shortcut:` en `UciEngine.ts`). `depth`/`movetime` deben ser enteros positivos. Sin comprobar que Cloudflare sirva el `.wasm` como `application/wasm` en producción (previews apagadas; sí con `vite preview`). Un solo PR de ~430 líneas de código (con HTML y config), dentro de lo razonable.
- **Test de `GameViewer`:** fallaba al correr toda la suite en una máquina de 12 núcleos (chessground se retrasa con muchos workers); ahora espera hasta 10 s y el test tiene 15 s. Si vuelve a fallar, limitar `maxWorkers` en vitest.
- **Entregado en T1.3:** `parseGamePgn` en `src/domain/pgn.ts` (N+1 posiciones: `fen`, `san`, `uci`, `clock` en segundos; enroque como `e1g1`, y rey-toma-torre si `Variant` es Chess960); `Board` crea chessground una vez y usa `api.set({ fen })`; `GameViewer` (Anterior/Siguiente) va dentro de la última partida de `/u/:user`. Comprobado en local con una partida real de 140 jugadas. Dependencia `chessops` añadida.
- **Decisiones y límites de T1.3:** no se creó `/u/:user/:gameId` (el visor va en `UserPage`; la ruta hará falta cuando se elijan otras partidas) ni `/pgn` (entrada por PGN). Los relojes se leen pero no se muestran. Sin flechas de teclado. `opacity: 0.5` de los botones deshabilitados no sale de `tokens.css`. El test del visor espera porque chessground retira la pieza capturada tras su animación.
- **T1.2:** wouter con `/` y `/u/:user` (cualquier otra ruta cae en la home); `getLastGame` y `outcome` en `chesscom.ts`; `Home` y `UserPage` en `src/ui/`.
- **⚠ DEUDA ACEPTADA: previews de Cloudflare apagadas.** El interruptor *Builds for Preview branches* está apagado a propósito; los builds de `main` (producción) funcionan.
  - **Causa:** los builds de rama ejecutan `npx wrangler versions upload` (modelo antiguo de previews) y fallan con «The name in your wrangler.jsonc file (chessanalyzer) must match the name of your Worker». Es el bug [cloudflare/workers-sdk#15682](https://github.com/cloudflare/workers-sdk/issues/15682) (`WRANGLER_CI_MATCH_TAG` de las ramas no corresponde a ningún Worker).
  - **Probado sin éxito:** `env -u WRANGLER_CI_MATCH_TAG …` en *Previews Base → Preview command*: ese campo se guarda pero los builds de rama lo ignoran. El panel no ofrece el banner «Set up Worker Previews» ni otro campo de comando para ramas; *Trigger events* no aplica (Worker solo con assets).
  - **Consecuencias:** no hay URL de preview por PR. La revisión de UI se hace en local con `npm run build && npx vite preview` (trae las mismas cabeceras). El criterio de T0.3 (`crossOriginIsolated` contra la preview) sigue sin cumplirse en Cloudflare.
  - **Para retomarlo:** contactar con Cloudflare o esperar el arreglo del issue; o desplegar previews desde GitHub Actions con un token como secreto (cambio de arquitectura: grilling + ADR). Al volver a activar el interruptor hace falta un bloque `"previews": {}` en `wrangler.jsonc` si se usa `npx wrangler preview`.
- **Cierre de M0:**
  - `/usage` al 22 %.
  - `npm run mutate` en verde, aunque vacío (score NaN, no hay dominio).
  - `ponytail-debt`: no hay ningún marcador `shortcut:`.
  - e2e Chromium, móvil, Firefox y WebKit en verde: run manual `all_browsers` 40480713028 sobre `main`.
  - `ponytail-audit`: dos hallazgos. Corregido el guard de git, que bloqueaba rutas con «commit»/«push» (PR #21). El segundo (`Board` recreaba chessground en cada `fen`) se corrigió en T1.3.
- **Cierre de M1:**
  - `npm run mutate` en verde: 86,5 % (`analysis.ts` 100 %, `pgn.ts` 90,9 %, `uci.ts` 92,1 %, `UciEngine.ts` 81,1 %, `chesscom.ts` 81,4 %). **Tardó 21 min**: pasar a `@stryker-mutator/vitest-runner` antes de M2.
  - e2e Chromium, móvil, Firefox y WebKit en verde: run manual `all_browsers` 40497619054 sobre `main`.
  - `ponytail-debt`: un solo marcador `shortcut:` (`UciEngine.ts`: solo ajedrez estándar y sin timeout de arranque).
  - `ponytail-audit`: sano, JS inicial ~115 KB gz (presupuesto 200). Dos hallazgos aceptados, sin tarea propia: (1) la CI no verifica que `public/engine/` coincida con los SHA-256 fijados: añadir `node scripts/vendor-engine.mjs --check` (sale con error si no coincide, sin descargar) como paso de CI antes del build; (2) falta un test de `UciEngine` para `stop()` entre `ucinewgame`/`isready` y `go` (la rama `if (job.settled) return` tras `readyok`). Los dos entran de paso en la primera tarea que toque el motor (T4.1/T4.2).
  - `/usage` al 53 % al cerrar M1 y T2.1 (revisado por la usuaria).
- **Cierre de M2:**
  - `npm run mutate` en verde: 91,3 % (`pgn.ts` 98,7 %, `games.ts` 100 %, `analysis.ts` 98,4 %, `engine/` 97,7 %, `chesscom.ts` 79,9 %, justo bajo el 80 % por archivo; el umbral que rompe es el total). **Tardó 44 min**: el aviso de pasar a `@stryker-mutator/vitest-runner` sigue en pie y ya es urgente.
  - e2e Chromium, móvil, Firefox y WebKit en verde: run manual `all_browsers` 40683351772 sobre `main`.
  - `ponytail-debt`: 6 marcadores `shortcut:`, todos con trigger (caché antigua, motor solo estándar, `moveCount` con variantes, lista pegada sin paginar, almacenamiento bloqueado, blancas siempre abajo).
  - `ponytail-audit`: sano, JS inicial ~110 KB gz, `npm audit` sin vulnerabilidades. Hallazgos aceptados, sin tarea propia: (1) «Cargar mes anterior» puede pisar la lista si se cambia de mes mientras carga: descartar la respuesta si `query.month` cambió; (2) un mes que falla tira toda la lista inicial (ya era límite de T2.3); (3) el paso 9 de `CLAUDE.md` habla de una preview de Cloudflare que no existe, mejor «revisar en local con `vite preview`»; (4) borrar las claves `games:v1:*` al abrir la caché. Los dos primeros entran de paso en la próxima tarea que toque `UserPage`.
  - `/usage`: por revisar por la usuaria.
- **Avisos:**
  - `stryker.config.json` lleva `"tsconfigFile": "none.json"` a propósito: el rewrite de tsconfig de Stryker peta con TypeScript 7. Quitarlo cuando Stryker soporte TS 7.
  - Si reaparecen sandboxes en `.stryker-tmp`, quitar primero los junctions con `rmdir` y después `rm -rf`.
  - `mutate` usa `@stryker-mutator/vitest-runner` (antes `command`, 44 min): 8 min 43 s, pero 85,8 % frente a 91,3 % (`UciEngine.ts` 81 %, `chesscom.ts` 78,7 %). Sin analizar por qué baja; `vitest.dir: src/domain` rompe la detección de tests ("No tests were found"), por eso no se usa.
    - T1.1 ya activa la cobertura de `src/domain/` (`chesscom.ts` 93,5 % ramas). Cliente: `getArchives` y `getMonthGames`, cola en serie; fixtures escritos a mano, no respuestas reales.  - Heredados: Lighthouse solo mide `/`; COEP `require-corp` y avatares de chess.com; cabeceras duplicadas en `_headers` y `vite.config.ts`.
- **Siguiente:** T3.2 (`sonnet`, `medium`, advisor off).

## Leyenda

- **Estado:** `pendiente` · `en curso` · `en review` · `hecha` · `cancelada`
- **Modelo:** `sonnet` (por defecto) · `opusplan` (+ plan mode) · `haiku` (vía subagente `mechanic`)
- **Esfuerzo:** `low` · `medium` · `high` → comando `/effort <nivel>`
- **Advisor:** `sí` → `/advisor opus` al empezar y `/advisor off` al cerrar
- **Skills:** `ponytail` está siempre activo y no se repite en cada tarea. `ponytail-review` va antes de cada PR (ver `CLAUDE.md`).
- **Tests:** U = unitario (Vitest) · C = componente (Testing Library) · I = integración (motor real) · E = e2e (Playwright + axe)

## Cierre de cada hito (checklist común)

1. `ponytail-audit` y `ponytail-debt`, con los hallazgos convertidos en tareas o aceptados en las notas.
2. Stryker en `src/domain/` con mutation score ≥ 80 %.
3. e2e con Firefox y WebKit (job manual de CI).
4. Recordatorio a la usuaria: revisar `/usage`.

---

## M0 · Base

### T0.0 · Metodología de trabajo — `hecha`
**Objetivo:** Dejar listos `CLAUDE.md`, `AGENTS.md`, `docs/`, `.claude/` (settings, hooks, subagentes, statusline) y la licencia GPL-3.0.
**Aceptación:**
- Dado un `/clear`, cuando arranca la sesión, entonces el hook muestra la rama y `▶ Siguiente tarea`.
- Dado un `git push` a `main`, cuando Claude lo intenta, entonces el hook lo bloquea.
**Depende de:** — · **Modelo:** opusplan · high · advisor no · **Skills:** grilling, writing-for-agents

### T0.1 · Esqueleto del proyecto — `hecha`
**Objetivo:** Crear el proyecto con Vite + React 19 + TypeScript estricto, con los comandos `dev`, `test`, `lint`, `typecheck`, `build` y `e2e` funcionando.
**RF:**
- Biome para lint y formato.
- Vitest + Testing Library.
- `simple-git-hooks`: `pre-commit` → `biome check --staged`; `commit-msg` → script que valida Conventional Commits.
- `engines.node` ≥ 24.
**RNF:** `tsconfig` con `strict`, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`.
**Aceptación:**
- Dado el repo recién clonado, cuando ejecuto `npm ci && npm test && npm run build`, entonces todo pasa.
- Dado un mensaje de commit `arreglo cosas`, cuando hago commit, entonces el hook lo rechaza y explica el formato.
**Tests:** U del validador de mensajes de commit · U de humo de la app.
**Depende de:** T0.0 · **Riesgos:** versiones de Biome/Vite con cambios incompatibles → fijar versiones.
**Modelo:** sonnet · medium · advisor no

### T0.2 · e2e y CI — `hecha`
**Objetivo:** CI en GitHub Actions que bloquea los PR rotos.
**RF:**
- Playwright con Chromium y un viewport móvil, y `@axe-core/playwright` integrado en un fixture común.
- Workflow en este orden: Biome → typecheck → test con cobertura (+ `node --test .claude/hooks/`) → build → e2e.
- Job manual (`workflow_dispatch`) con Firefox y WebKit.
- Dependabot mensual y agrupado (npm + Actions).
- `.github/pull_request_template.md`.
**RNF:** la CI tarda < 6 min, con caché de `npm` y de los navegadores de Playwright.
**Aceptación:**
- Dado un PR con un error de tipos, cuando se ejecuta la CI, entonces falla el job typecheck.
- Dada la página inicial, cuando se ejecuta el e2e, entonces axe no reporta violaciones *serious* ni *critical*.
**Tests:** E de humo + a11y.
**Depende de:** T0.1 · **Riesgos:** minutos de CI → el repo es público, sin cuota.
**Modelo:** sonnet · medium · advisor no

### T0.3 · Despliegue y protección de `main` — `hecha`
**Objetivo:** Despliegue en Cloudflare Pages con aislamiento cross-origin y `main` protegida.
**RF:**
- `public/_headers` con COOP `same-origin` y COEP `require-corp`.
- Previsualización por PR.
- Protección de rama vía `gh api`: PR obligatorio y checks de CI requeridos (**pedir permiso**).
- Guía paso a paso para la usuaria, con la skill `wizard`.
**Aceptación:**
- Dado el despliegue, cuando abro la app, entonces `crossOriginIsolated === true` (lo comprueba un e2e contra la URL de previsualización).
- Dado un push directo a `main`, cuando lo intento, entonces GitHub lo rechaza.
**Tests:** E de `crossOriginIsolated` (en local con `vite preview` configurado con las mismas cabeceras).
**Depende de:** T0.2 · **Riesgos:** necesita acción manual en el panel de Cloudflare.
**⚠ Deuda aceptada:** las previews de rama de Cloudflare están apagadas por un bug de Cloudflare, así que el e2e contra la preview no se cumple. Ver las notas de traspaso.
**Modelo:** sonnet · low · advisor no · **Skills:** wizard

### T0.4 · i18n — `hecha`
**Objetivo:** Que todo texto visible salga de `src/i18n/es.json`.
**RF:**
- i18next + react-i18next con claves tipadas: una clave inexistente no compila.
- Helpers de `Intl` para números, fechas y porcentajes.
**Aceptación:**
- Dado `t('clave.inexistente')`, cuando ejecuto typecheck, entonces falla.
**Tests:** U de los helpers de `Intl`.
**Depende de:** T0.1 · **Modelo:** sonnet · low · advisor no

### T0.5 · Hoja de estilo «club clásico reinventado» — `hecha`
**Objetivo:** Fijar la identidad visual C y sus tokens, con aprobación de la usuaria.
**RF:**
- Una página `/styleguide` (sin enlazar y con `noindex`) con:
  - paleta (madera oscura, latón, verde fieltro) en modo oscuro y claro;
  - tipografías: una serif con carácter y una de interfaz, servidas desde el propio sitio;
  - escala de espaciado y radios;
  - tokens de motion (duraciones, curvas);
  - tablero chessground con tema propio y piezas con licencia compatible con la GPL;
  - las 9 etiquetas de jugada con icono y color;
  - barra de evaluación y una animación de muestra.
- `src/styles/tokens.css` y `docs/DESIGN.md`.
**RNF:**
- Contraste AA en todas las combinaciones de texto.
- `prefers-reduced-motion` respetado.
- Fuentes como woff2 con subconjunto latino, ≤ 120 KB en total.
**Aceptación:**
- Dada la hoja de estilo, cuando la usuaria la revisa, entonces la aprueba explícitamente (iterar hasta ello).
- Dada cualquier pareja texto/fondo de los tokens, cuando se mide, entonces el contraste es ≥ 4.5:1 (≥ 3:1 en texto grande).
**Tests:** E de axe sobre `/styleguide`.
**Depende de:** T0.1, T0.4 · **Riesgos:** iteraciones visuales caras en tokens → una sola propuesta e iterar sobre ella.
**Modelo:** sonnet · high · advisor no · **Skills:** frontend-design

### T0.6 · Lighthouse CI y presupuesto — `hecha`
**Objetivo:** Detectar regresiones de rendimiento y accesibilidad en la CI.
**RF:**
- Lighthouse CI sobre `vite preview`.
- Presupuesto en `lighthouserc.json` (no `budget.json`: LHCI no lo aplica junto a las aserciones de puntuación): JS ≤ 200 KB gz y fuentes ≤ 120 KB.
**Aceptación:**
- Dado un PR que supera el presupuesto, cuando se ejecuta la CI, entonces falla con la métrica concreta.
- Dada la página inicial, cuando se mide, entonces rendimiento ≥ 90 y accesibilidad = 100.
**Depende de:** T0.2, T0.5 · **Modelo:** sonnet · low · advisor no

### T0.7 · Umbrales de cobertura y Stryker — `hecha`
**Objetivo:** Que los umbrales de calidad sean ejecutables desde M1.
**RF:**
- Vitest con cobertura v8: umbral ≥ 90 % de ramas en `src/domain/**` (falla la CI).
- Stryker limitado a `src/domain/`, con `npm run mutate` (manual, al cerrar cada hito) y umbral de 80 %.
**Aceptación:**
- Dado un archivo de dominio con una rama sin test, cuando ejecuto `npm test -- --coverage`, entonces falla indicando el archivo.
**Depende de:** T0.2 · **Modelo:** sonnet · low · advisor no

---

## M1 · Tracer bullet (de punta a punta, mínimo y desplegado)

### T1.1 · Cliente mínimo de chess.com — `hecha`
**Objetivo:** Obtener la lista de archivos mensuales y las partidas de un mes.
**RF:**
- `getArchives(user)` y `getMonthGames(url)` con tipos de dominio.
- Peticiones **en serie** (cola de una en una).
- Sin cabeceras propias: ni `User-Agent` ni condicionales.
**Aceptación:**
- Dado `hikaru`, cuando pido los archivos, entonces recibo las URL de los meses ordenadas.
- Dadas dos llamadas simultáneas, cuando se ejecutan, entonces la segunda empieza al terminar la primera.
**Tests:** U con MSW (fixtures reales recortados en `tests/fixtures/chesscom/`).
**Depende de:** T0.1 · **Riesgos:** cambios en el formato de la API → validar la respuesta en la frontera.
**Modelo:** sonnet · medium · advisor no · **Skills:** tdd

### T1.2 · Pantalla de inicio: usuario → última partida — `hecha`
**Objetivo:** Introducir un usuario y ver su última partida (jugadores, Elo, resultado).
**RF:**
- Rutas con wouter desde el principio: `/`, `/u/:user`, `/u/:user/:gameId`, `/pgn`, con fallback SPA en Cloudflare.
- Formulario accesible con etiqueta visible.
- Estado de carga.
- Error genérico por ahora.
**Aceptación:**
- Dado un usuario válido, cuando envío el formulario, entonces voy a `/u/:user` y veo su última partida.
- Dada la URL `/u/:user` abierta directamente, cuando carga, entonces muestra lo mismo.
**Tests:** C del formulario · E con la API simulada (`page.route` en Playwright).
**Depende de:** T1.1, T0.5 · **Modelo:** sonnet · medium · advisor no · **Skills:** frontend-design

### T1.3 · PGN → tablero con avance y retroceso — `hecha`
**Objetivo:** Reproducir la partida en chessground.
**RF:**
- Parser con chessops: lista de posiciones (FEN, SAN, UCI, reloj `[%clk]`).
- Tablero de solo lectura con botones anterior y siguiente.
**Aceptación:**
- Dado el PGN de una partida de chess.com, cuando lo parseo, entonces obtengo N+1 posiciones y relojes.
- Dado el tablero, cuando pulso «siguiente», entonces la pieza se anima a su casilla.
**Tests:** U del parser (PGN reales, con comentarios y relojes) · C del tablero (renderiza la FEN).
**Depende de:** T1.2 · **Modelo:** sonnet · medium · advisor no · **Skills:** tdd, frontend-design

### T1.4 · Módulo del motor (interfaz y lite de un hilo) — `hecha`
**Objetivo:** Diseñar la interfaz del motor y conectarla a Stockfish 19 lite de un hilo en un Web Worker.
**RF:**
- Interfaz `Engine` profunda (diseñada con `codebase-design`): `analyse(fen, opts) → Promise<Eval>` y `stop()`.
- Implementación UCI sobre el Worker.
- Motor vendorizado (ADR): `scripts/vendor-engine.mjs` descarga de unpkg, con la versión fijada, lite multihilo, lite de un hilo y asm.js a `public/engine/` y verifica el SHA-256. Los archivos se suben al repo (~7 MB); el paquete npm `stockfish` no se instala.
- `FakeEngine` para los tests.
**RNF:**
- La UI nunca se bloquea.
- El `.wasm` se sirve como `application/wasm`.
**Aceptación:**
- Dada la posición inicial, cuando analizo a profundidad 10, entonces recibo una evaluación entre −100 y +100 cp y una mejor jugada legal.
- Dada una posición de mate en 1, cuando analizo, entonces recibo `mate: 1` y la jugada que da mate.
**Tests:** U del parser de líneas UCI (`info`, `bestmove`, mate, cotas) con `FakeEngine` · I con el motor real (Playwright, 2 casos).
**Depende de:** T1.3 · **Modelo:** `/model opusplan` + plan mode para el diseño; luego `/effort high` · advisor sí (`/advisor opus` al empezar, `/advisor off` al cerrar) · **Skills:** grilling, codebase-design · **Riesgos:** carga del Worker en Vite dev/prod → probarlo pronto en la previsualización.
**Modelo:** opusplan · high · advisor sí · **Skills:** codebase-design, tdd

### T1.5 · Análisis de la partida (versión tracer) — `hecha`
**Objetivo:** Analizar todas las posiciones en serie y mostrar la evaluación por jugada y una barra simple.
**Aceptación:**
- Dada una partida cargada, cuando pulso «Analizar», entonces veo el progreso y, al acabar, la evaluación de cada jugada.
- Dado el flujo completo usuario → partida → análisis, cuando se ejecuta en la previsualización desplegada, entonces funciona.
**Tests:** C con `FakeEngine` · E del flujo completo con MSW y motor real a profundidad baja.
**Depende de:** T1.4 · **Modelo:** sonnet · medium · advisor no

---

## M2 · Carga de partidas completa

### T2.1 · Errores de la API y validación de usuario — `hecha` (PR #34)
**Objetivo:** Que cada fallo de la API tenga su mensaje y su recuperación.
**RF:**
- `GET /player/{user}` antes de pedir los archivos.
- Casos:
  - **usuario inexistente** (404);
  - **usuario sin partidas** (archivos vacíos);
  - **429** con reintento y espera exponencial (máximo 3);
  - **red caída** u offline, con reintento manual;
  - timeout de 15 s;
  - respuesta con forma inesperada.
- Normalización del usuario: recortar espacios y pasar a minúsculas.
**Aceptación:**
- Dado `usuario_que_no_existe_123`, cuando busco, entonces veo «No existe ese usuario en chess.com» y el campo conserva el texto.
- Dado un 429 y después un 200, cuando busco, entonces se reintenta solo y carga sin error visible.
- Dado `navigator.onLine === false`, cuando busco, entonces veo el estado sin conexión con «Reintentar».
**Tests:** U de la cola y los reintentos (temporizadores falsos) · E de cada error con MSW.
**Depende de:** T1.5 · **Modelo:** sonnet · medium · advisor no · **Skills:** tdd

### T2.2 · Caché de partidas — `hecha` (PR #37)
**Objetivo:** No volver a descargar lo que no puede cambiar.
**RF:**
- Los **meses cerrados** son inmutables y se guardan en IndexedDB (idb-keyval) por URL.
- El **mes en curso** se revalida con la caché HTTP del navegador, que gestiona `ETag` y `max-age=60` sin cabeceras manuales (ver ADR).
- Versión de esquema en la clave.
**Aceptación:**
- Dado un mes cerrado ya cargado, cuando vuelvo a abrir el usuario, entonces no se hace ninguna petición a ese mes.
**Tests:** U con `fake-indexeddb` · E que cuenta las peticiones.
**Depende de:** T2.1 · **Riesgos:** cuota de IndexedDB llena → atrapar `QuotaExceededError` y seguir sin caché.
**Modelo:** sonnet · medium · advisor no · **Skills:** tdd

### T2.3 · Lista de partidas por meses — `hecha` (PR #39)
**Objetivo:** Explorar el historial completo.
**RF:**
- Lista del mes más reciente, con «Cargar mes anterior».
- Tarjeta por partida: rival, Elo, ritmo, color, resultado, fecha y número de jugadas.
- Teclado: la lista es navegable y Enter abre la partida.
- La partida se abre en `/u/:user/:gameId` con el usuario abajo (tablero y barra de evaluación girados si llevó negras).
- Un mes que chess.com lista pero responde con 404 se marca «no disponible» y se puede seguir cargando los anteriores.
**RNF:** 500 partidas sin tirones (virtualización solo si hace falta, medida antes).
**Aceptación:**
- Dado un usuario con 3 meses de partidas, cuando cargo meses anteriores, entonces se añaden en orden sin duplicados.
**Tests:** C de la tarjeta y la lista · E del flujo.
**Depende de:** T2.2 · **Modelo:** sonnet · medium · advisor no · **Skills:** frontend-design

### T2.4 · Filtros en cliente — `hecha`
**Objetivo:** Filtrar por ritmo (bullet/blitz/rápida/diaria), color, resultado y mes.
**Aceptación:**
- Dados los filtros «blitz + negras + derrota», cuando los aplico, entonces solo veo esas partidas y un contador.
- Dado un filtro sin resultados, cuando lo aplico, entonces veo un estado vacío con «Quitar filtros».
- Dada una partida abierta desde la lista filtrada, cuando pulso atrás en el navegador, entonces vuelvo a la lista con los filtros intactos (los filtros viven en la query string).
**Tests:** U de la función de filtrado · C de los controles · E del botón atrás.
**Depende de:** T2.3 · **Modelo:** sonnet · low · advisor no · **Skills:** frontend-design

### T2.5 · Pegar PGN — `hecha` (PR #45)
**Objetivo:** Analizar cualquier partida sin chess.com.
**RF:**
- Área de texto con validación.
- **PGN malformado** → error con la línea o jugada problemática.
- Varios juegos en el mismo PGN → elegir uno.
**Aceptación:**
- Dado un PGN con una jugada ilegal en la 12, cuando lo pego, entonces veo «Jugada ilegal en 12. …» y no se abre el tablero.
**Tests:** U de la validación · C · E.
**Depende de:** T1.3 · **Modelo:** sonnet · low · advisor no · **Skills:** frontend-design

### T2.6 · Partidas no estándar — `hecha` (PR #47)
**Objetivo:** Detectar las variantes y avisar.
**RF:**
- Cabeceras `Variant` y `SetUp`/`FEN`, y `rules` de la API.
- **Chess960** y otras variantes → la tarjeta se marca «No compatible» y no se puede analizar.
- Las partidas estándar que empiezan desde una FEN sí se admiten.
**Aceptación:**
- Dada una partida Chess960, cuando aparece en la lista, entonces está marcada y al abrirla se explica el motivo.
**Tests:** U de la detección · E.
**Depende de:** T2.3 · **Modelo:** sonnet · low · advisor no · **Skills:** tdd

---

## M3 · Tablero y reproducción

### T3.1 · Lista de jugadas — `hecha` (PR #50)
**Objetivo:** Navegar por la partida desde su notación.
**RF:**
- SAN en pares numerados; clic para saltar a una jugada.
- Jugada actual resaltada y desplazada a la vista.
- Relojes `[%clk]` por jugada.
- Encabezado con el nombre de la apertura (cuando exista, en M5).
**Aceptación:**
- Dada la jugada 23 en la lista, cuando hago clic, entonces el tablero muestra esa posición.
**Tests:** C · E.
**Depende de:** T1.3 · **Modelo:** sonnet · medium · advisor no · **Skills:** frontend-design

### T3.2 · Teclado y lector de pantalla — `hecha` (PR #53)
**Objetivo:** Recorrer la partida sin ratón.
**RF:**
- ←/→, Inicio/Fin y `F` para girar el tablero.
- `aria-live` que anuncia «12. Cf3, blancas» (más la etiqueta en M5).
- Foco visible.
**Aceptación:**
- Dado el foco en el visor, cuando pulso →, entonces avanzo una jugada y se anuncia.
**Tests:** E de teclado + axe.
**Depende de:** T3.1 · **Modelo:** sonnet · medium · advisor no

### T3.3 · Sonidos — `hecha` (PR #55)
**Objetivo:** Sonido de jugada, captura, jaque y fin de partida.
**RF:**
- Silenciable; la preferencia se guarda.
- Apagados por defecto con `prefers-reduced-motion`.
- Sonidos con licencia compatible con la GPL y atribuida.
**Aceptación:**
- Dado el sonido silenciado, cuando avanzo, entonces no suena nada y al recargar sigue silenciado.
**Tests:** C del interruptor y la persistencia.
**Depende de:** T3.1 · **Riesgos:** licencia de los sonidos → verificarla antes de añadirlos.
**Modelo:** sonnet · low · advisor no · **Skills:** frontend-design

### T3.4 · Diseño móvil — `hecha` (PR #57)
**Objetivo:** Visor completo y cómodo en 375 px.
**RF:**
- Tablero a ancho completo y controles táctiles de ≥ 44 px.
- La lista de jugadas en un panel plegable.
**Aceptación:**
- Dado un viewport de 375×812, cuando recorro una partida, entonces no hay scroll horizontal y todos los controles son alcanzables.
**Tests:** E en viewport móvil + axe.
**Depende de:** T3.2 · **Modelo:** sonnet · medium · advisor no · **Skills:** frontend-design

---

## M4 · Motor robusto

### T4.1 · Detección de capacidades y fallback — `hecha` (PR #60)
**Objetivo:** Elegir siempre la mejor variante que funcione.
**RF:**
- Cadena de fallback:
  1. lite multihilo si `crossOriginIsolated`;
  2. lite de un hilo;
  3. asm.js si no hay WebAssembly.
- **Motor que no carga** (timeout de 10 s o error) → aviso y partida navegable sin análisis.
- Variante visible en «Acerca del análisis».
**Aceptación:**
- Dado un navegador sin `SharedArrayBuffer`, cuando abro una partida, entonces se usa lite de un hilo sin errores.
- Dado un Worker que no responde a `uci`, cuando pasan 10 s, entonces veo «No se pudo cargar el motor» y puedo seguir recorriendo la partida.
**Tests:** U de la selección (capacidades inyectadas) · E forzando cada rama.
**Depende de:** T1.5 · **Modelo:** sonnet · high · advisor sí · **Skills:** tdd

### T4.2 · Cola de análisis — `hecha` (PR #62)
**Objetivo:** Un análisis completo, configurable, cancelable y progresivo.
**RF:**
- MultiPV 2.
- Profundidad 16 en multihilo y 12 en un hilo o móvil.
- Hilos `min(hardwareConcurrency − 1, 4)`; hash de 64 MB (16 MB en móvil).
- Cancelación con `stop` y un identificador por análisis.
- Progreso «jugada N de M».
- La parte ya analizada se puede recorrer mientras sigue el resto.
**RNF:** sin fugas de Workers; al cambiar de partida se descarta el análisis anterior.
**Aceptación:**
- Dado un análisis en curso, cuando abro otra partida, entonces el primero se detiene y ninguno de sus resultados llega a la nueva.
- Dado un análisis al 50 %, cuando voy a la jugada 3, entonces veo su evaluación.
**Tests:** U de la cola (`FakeEngine` con latencias) · I con el motor real (cancelación).
**Depende de:** T4.1 · **Riesgos:** condiciones de carrera → test de orden de mensajes.
**Modelo:** sonnet · high · advisor sí · **Skills:** tdd

### T4.3 · Caché de análisis — `hecha` (PR #64)
**Objetivo:** Que reabrir una partida analizada sea instantáneo.
**RF:**
- Clave = URL o hash del PGN + variante + profundidad + versión de esquema.
- Si falla la cuota de IndexedDB, se sigue sin caché.
**Aceptación:**
- Dada una partida ya analizada, cuando la reabro, entonces el resultado aparece en < 300 ms sin arrancar el motor.
**Tests:** U con `fake-indexeddb` · E.
**Depende de:** T4.2 · **Modelo:** sonnet · medium · advisor no · **Skills:** tdd

### T4.4 · Partidas muy largas y rendimiento — `hecha` (PR #66)
**Objetivo:** Que una partida de más de 200 jugadas sea fluida.
**RF:**
- La UI se actualiza agrupada (un render por jugada analizada, no por cada línea `info`).
**Aceptación:**
- Dada una partida de 300 medias jugadas, cuando se analiza, entonces la navegación sigue a 60 fps (sin long tasks > 50 ms del hilo principal).
**Tests:** E con medición de long tasks · U del agrupado.
**Depende de:** T4.2 · **Modelo:** sonnet · medium · advisor no · **Skills:** diagnosing-bugs (si hay regresión)

### T4.5 · Modo «análisis profundo» (versión full desde unpkg) — `pendiente`
**Objetivo:** Ofrecer la red NNUE grande sin alojar 99 MB.
**RF:**
- Opción en escritorio con aviso del tamaño.
- Descarga con barra de progreso (`fetch` en streaming).
- Guardado en la Cache API: solo se descarga una vez.
- `.js` alojado por nosotros y `locateFile` apuntando a unpkg con la versión fijada.
- Comprobación de integridad (SHA-256 fijado).
- Si falla, se vuelve a lite con aviso.
**Aceptación:**
- Dado el modo profundo activado por primera vez, cuando se descarga, entonces veo el progreso en MB y al recargar no se vuelve a descargar.
- Dado unpkg caído, cuando lo activo, entonces veo el error y el análisis sigue con lite.
**Tests:** U del gestor de descarga y caché (fetch simulado) · I manual documentado (99 MB no van a la CI).
**Depende de:** T4.3 · **Riesgos:** unpkg sin garantías de servicio; memoria en equipos modestos; el Worker no puede cargarse desde otro origen.
**Modelo:** sonnet · high · advisor sí

---

## M5 · Análisis completo

### T5.1 · % de victoria y precisión (lichess) — `pendiente`
**Objetivo:** La fórmula exacta de lichess (ADR-0xx).
**RF:**
- `winPercent(cp)` con límite de ±1000 cp; el mate cuenta como ±1000.
- `moveAccuracy(caída)`.
- `gameAccuracy(jugadas)`: media ponderada por volatilidad + media armónica.
**Aceptación:**
- Dados los vectores de prueba tomados del código de lichess, cuando calculo, entonces coinciden con un error < 0,01.
**Tests:** U exhaustivos y basados en propiedades (monotonía, límites).
**Depende de:** T4.2 · **Modelo:** sonnet · high · advisor sí · **Skills:** tdd

### T5.2 · Clasificación básica — `pendiente`
**Objetivo:** Etiquetas mejor, buena, imprecisión, error y error grave (umbrales en ADR).
**RF:**
- Única jugada legal → sin etiqueta y sin penalización.
- Umbrales en una única tabla de constantes.
**Aceptación:**
- Dada una caída de 12, cuando clasifico, entonces la etiqueta es «error».
- Dada una jugada igual a la PV1, cuando clasifico, entonces la etiqueta es «mejor».
**Tests:** U con un caso por cada frontera de umbral.
**Depende de:** T5.1 · **Modelo:** sonnet · medium · advisor no · **Skills:** tdd

### T5.3 · Libro y nombre de la apertura — `pendiente`
**Objetivo:** Etiqueta «libro» y nombre de la apertura.
**RF:**
- Script de build que convierte lichess-org/chess-openings (CC0) en un mapa EPD → nombre comprimido.
- Carga diferida.
**RNF:** ≤ 120 KB gz y fuera del bundle inicial.
**Aceptación:**
- Dada 1.e4 e5 2.Cf3 Cc6 3.Ab5, cuando clasifico, entonces las 5 jugadas son «libro» y la apertura es «Apertura española».
**Tests:** U del script y de la búsqueda.
**Depende de:** T5.2 · **Modelo:** sonnet · medium · advisor no

### T5.4 · Etiquetas especiales — `pendiente`
**Objetivo:** Gran jugada, brillante y oportunidad perdida (reglas en ADR).
**Aceptación:**
- Dada una jugada que es la mejor y cuya PV2 pierde ≥ 10, cuando clasifico, entonces es «gran jugada».
- Dado un sacrificio de dama que es la mejor jugada y deja % de victoria ≥ 50, cuando clasifico, entonces es «brillante».
- Dado un error grave del rival seguido de una jugada mía que pierde 15, cuando clasifico, entonces es «oportunidad perdida».
**Tests:** U con posiciones reales (FEN + PV simuladas).
**Depende de:** T5.2 · **Riesgos:** falsos positivos de «brillante» → `shortcut:` documentado, calibrar con partidas reales.
**Modelo:** sonnet · high · advisor sí · **Skills:** tdd

### T5.5 · Barra y gráfico de evaluación — `pendiente`
**Objetivo:** Ver la partida de un vistazo.
**RF:**
- Barra animada que muestra «M3» en los mates.
- Gráfico SVG propio: área blanca y negra, clic o teclado para saltar a una jugada, marcadores por etiqueta, línea de la jugada actual.
- El gráfico tiene una alternativa textual accesible.
**Aceptación:**
- Dado el gráfico, cuando hago clic en un punto, entonces el tablero salta a esa jugada.
- Dado un lector de pantalla, cuando llega al gráfico, entonces se anuncia un resumen y se puede recorrer.
**Tests:** C (puntos ↔ jugadas) · E + axe.
**Depende de:** T5.2 · **Modelo:** sonnet · medium · advisor no · **Skills:** frontend-design

### T5.6 · Panel de jugada y mejor alternativa — `pendiente`
**Objetivo:** Entender cada jugada.
**RF:**
- Etiqueta con icono, caída en % y precisión.
- Mejor jugada con flecha en el tablero y PV navegable (solo lectura).
**Aceptación:**
- Dada una jugada «error», cuando la selecciono, entonces veo la mejor alternativa con su flecha y puedo recorrer su línea y volver.
**Tests:** C · E.
**Depende de:** T5.4, T5.5 · **Modelo:** sonnet · medium · advisor no · **Skills:** frontend-design

### T5.7 · Resumen y momentos clave — `pendiente`
**Objetivo:** El informe de la partida.
**RF:**
- Precisión por bando y recuento de etiquetas.
- Momentos clave: brillante, gran jugada, error grave, error, oportunidad perdida y punto de inflexión.
- Botón y tecla `N` para saltar al siguiente.
**Aceptación:**
- Dada una partida con 3 momentos clave, cuando pulso `N` tres veces, entonces visito los tres en orden cronológico.
**Tests:** U del cálculo de momentos clave · C · E.
**Depende de:** T5.6 · **Modelo:** sonnet · medium · advisor no · **Skills:** frontend-design, tdd

### T5.8 · Rendimiento estimado (opcional) — `pendiente`
**Objetivo:** Un Elo orientativo de la partida, solo si hay una fuente citable.
**RF:**
- Investigar una regresión publicada precisión/ACPL → Elo y documentarla en una ADR.
- Etiqueta «orientativo» en la UI.
- Si no hay una fuente decente → `cancelada` con el motivo.
**Tests:** U de la fórmula.
**Depende de:** T5.7 · **Modelo:** sonnet · medium · advisor no · **Skills:** tdd

---

## M6 · Pulido visual y calidad

### T6.1 · Animaciones con intención — `pendiente`
**Objetivo:** Movimiento que cuente la partida.
**RF:**
- La barra «empuja» al caer un error grave.
- Revelado en secuencia de los momentos clave.
- Transiciones entre pantallas.
- Todo con alternativa para `prefers-reduced-motion`.
**RNF:** solo `transform`/`opacity`; sin long tasks.
**Tests:** E con reduced-motion (sin animaciones).
**Depende de:** T5.7 · **Modelo:** sonnet · medium · advisor no · **Skills:** frontend-design

### T6.2 · Estados vacío, de carga y de error — `pendiente`
**Objetivo:** Revisar todos los estados de la tabla de errores de abajo con un diseño coherente.
**Aceptación:**
- Dado cada caso de la tabla de errores, cuando se provoca, entonces tiene su diseño, su texto y su acción de recuperación.
**Tests:** E por caso (reutiliza los de M2 y M4).
**Depende de:** T6.1 · **Modelo:** sonnet · medium · advisor no · **Skills:** frontend-design

### T6.3 · Modo claro — `pendiente`
**Objetivo:** Tema claro opcional; por defecto oscuro o el del sistema; la preferencia se guarda.
**Tests:** C del interruptor · E + axe en los dos temas.
**Depende de:** T6.1 · **Modelo:** sonnet · low · advisor no · **Skills:** frontend-design

### T6.4 · Auditoría de accesibilidad y rendimiento — `pendiente`
**Objetivo:** Cumplir WCAG 2.2 AA y Lighthouse ≥ 90/100 en todas las pantallas.
**RF:**
- Pase manual con teclado y NVDA (checklist en la PR).
- Corrección de hallazgos.
**Depende de:** T6.2, T6.3 · **Modelo:** sonnet · medium · advisor no

### T6.5 · Navegadores — `pendiente`
**Objetivo:** e2e en verde en Firefox y WebKit; correcciones.
**Depende de:** T6.4 · **Modelo:** sonnet · medium · advisor no · **Skills:** diagnosing-bugs

---

## M7 · Lanzamiento v1.0

### T7.1 · README, licencias y «Acerca de» — `pendiente`
**Objetivo:** Cumplir con la GPL y con todas las atribuciones.
**RF:**
- README (qué es, cómo ejecutarlo, licencia).
- Atribuciones: Stockfish, chessground, chessops, chess-openings, piezas, sonidos y fuentes.
- Página «Acerca de» con enlace al código fuente y a la versión exacta del motor.
**Depende de:** T6.5 · **Modelo:** haiku (`mechanic`) · low · advisor no

### T7.2 · Cierre de v1.0 — `pendiente`
**Objetivo:** Checklist de hito completa, etiqueta `v1.0.0` y despliegue de producción verificado.
**Depende de:** T7.1 · **Modelo:** sonnet · medium · advisor no

---

## Backlog post-MVP (sin orden fijado; pasar por grilling antes de planificar)

- B1 · Partidas de lichess
- B2 · Pantalla de historial de análisis
- B3 · Estadísticas agregadas
- B4 · Modo explorar posición y jugar variantes
- B5 · Reentrenar mis errores
- B6 · Soporte de Chess960
- B7 · Traducción al inglés
- B8 · PWA / offline

## Casos de error → tarea

| Caso | Tarea |
|---|---|
| Usuario inexistente | T2.1 |
| Usuario sin partidas | T2.1 |
| 429 / red caída / timeout | T2.1 |
| Partidas no estándar (Chess960, variantes) | T2.6 |
| PGN malformado | T2.5 |
| Motor que no carga | T4.1 |
| Navegador sin hilos WASM / sin `SharedArrayBuffer` | T4.1 |
| Partidas muy largas | T4.4 |
| Cuota de IndexedDB llena | T2.2, T4.3 |
| unpkg caído (modo profundo) | T4.5 |
