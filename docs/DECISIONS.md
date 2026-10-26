# Decisiones (ADR)

Formato breve: **Contexto · Decisión · Descartado · Consecuencias**. Todas salen del grilling inicial (2026-10-26) salvo que se indique otra fecha. Para reabrir una decisión hace falta pasar por grilling y escribir una ADR nueva que sustituya a la anterior.

---

### ADR-001 · Alcance del MVP
- **Contexto:** Hay que validar el producto con el mínimo de trabajo posible.
- **Decisión:**
  - Fuentes: partidas de chess.com + PGN pegado.
  - Lista con filtros en cliente (ritmo, color, resultado, mes).
  - Análisis completo, cacheado en IndexedDB.
  - Chess960 y otras variantes se excluyen con un aviso.
  - Escritorio como objetivo principal, totalmente usable en móvil. Sin PWA.
- **Descartado (va al backlog):** lichess, pantalla de historial, estadísticas agregadas, modo explorar o jugar variantes, reentrenar errores, Chess960, inglés, offline.
- **Consecuencias:** pegar PGN sirve también como alternativa si falla la API y como base de los e2e.

### ADR-002 · Licencia GPL-3.0 y repositorio público
- **Contexto:** Servir el `.wasm` de Stockfish (GPL-3.0) desde nuestra web es distribuirlo.
- **Decisión:** todo el proyecto bajo GPL-3.0, en el repo público `valbuDAM/chessAnalyzer`. La app tendrá atribuciones y un enlace al código fuente.
- **Descartado:** una licencia permisiva (no es compatible con distribuir Stockfish junto a la app) o un repo privado (complica cumplir la GPL y tiene cuota de CI).
- **Consecuencias:** se pueden usar chessground y chessops (GPL). Todo recurso de terceros (piezas, sonidos, fuentes) debe tener una licencia compatible y quedar atribuido.

### ADR-003 · i18n con i18next desde el principio
- **Contexto:** De momento solo español, pero la usuaria quiere tener la librería «por si acaso».
- **Decisión:**
  - i18next + react-i18next.
  - Textos en `src/i18n/es.json` con claves tipadas: una clave inexistente no compila.
  - Números y fechas con `Intl`.
- **Descartado:** Lingui (necesita un plugin de compilación) y no tener i18n (era la recomendación inicial; la usuaria decidió incluirla).
- **Consecuencias:** unos 15 KB gz más. Añadir un idioma será traducir un JSON.

### ADR-004 · Dirección visual: club clásico reinventado
- **Contexto:** La usuaria quiere algo «más llamativo» que la referencia y nada de «look genérico de IA».
- **Decisión:**
  - Estética: madera oscura, latón y verde fieltro; serif con carácter y micro-animaciones táctiles.
  - Modo oscuro por defecto y modo claro opcional.
  - Sonidos sutiles y silenciables.
  - `prefers-reduced-motion` siempre respetado.
  - Se fija en una hoja de estilo (T0.5) con frontend-design, de la que salen `tokens.css` y `DESIGN.md`.
- **Descartado:** «nocturno eléctrico» y «editorial y deportiva». Tampoco tres prototipos en paralelo, por coste.
- **Consecuencias:** todos los componentes usan los tokens. M6 pule, no rediseña.

### ADR-005 · Stack base
- **Decisión:**

| Pieza | Elegido |
|---|---|
| Framework | Vite + React 19 + TS estricto |
| Reglas y PGN | chessops |
| Tablero | chessground |
| Gráfico | SVG propio |
| Estado | Solo React |
| Persistencia | idb-keyval |
| Lint y formato | Biome |

- **Descartado:** chess.js (no encaja de forma nativa con chessground ni soporta Chess960), Recharts/visx (dependencias para un gráfico de área), Zustand/Redux (no hacen falta todavía), ESLint + Prettier (dos herramientas más lentas).
- **Consecuencias:** chessops y chessground son del ecosistema lichess, con tipos y bien mantenidos.

### ADR-006 · Tests y CI
- **Decisión:**
  - Vitest + Testing Library.
  - MSW o `page.route` para la API.
  - `FakeEngine` en los unitarios.
  - Playwright con Chromium y un viewport móvil, y axe en cada e2e.
  - Firefox y WebKit en un job manual al cerrar cada hito.
  - Pocas pruebas con el motor real.
  - GitHub Actions: Biome → typecheck → tests con cobertura → build → e2e.
- **Consecuencias:** la CI es rápida y la mayor parte de la confianza viene del dominio puro.

### ADR-007 · Umbrales de calidad
- **Decisión:**
  - ≥ 90 % de ramas cubiertas en `src/domain/`, sin umbral global.
  - WCAG 2.2 AA: axe sin violaciones *serious* ni *critical*, teclado completo y lector de pantalla.
  - Lighthouse: rendimiento ≥ 90, accesibilidad = 100, LCP < 2,5 s.
  - Presupuesto: JS inicial ≤ 200 KB gz, fuentes ≤ 120 KB.
  - Stryker en `src/domain/` con ≥ 80 %, al cerrar cada hito.
- **Descartado:** Stryker en cada PR (multiplica el tiempo de CI) y un umbral de cobertura global (en UI es ruido).

### ADR-008 · Variante del motor y fallback
- **Contexto:**
  - Full: 99 MB (red NNUE grande incluida). Lite: 1,7–1,9 MB.
  - Cloudflare Pages admite como máximo 25 MiB por archivo. jsDelivr rechaza el paquete. unpkg sirve el full con `CORP: cross-origin`.
  - `lichess-org/stockfish-web` es AGPL y difícil de integrar.
- **Decisión:**
  - Por defecto, Stockfish 19 **lite**: multihilo si `crossOriginIsolated`, si no de un hilo, y asm.js como último recurso.
  - Si no carga, la partida se puede recorrer sin análisis.
  - **Modo profundo opcional** (T4.5): el full desde unpkg con la versión fijada, verificación de SHA-256, barra de progreso y Cache API.
- **Descartado:** el full por defecto (99 MB en móvil, no cabe en Pages) y stockfish-web.
- **Consecuencias:** la app es ligera y funciona en cualquier navegador. El modo profundo depende de unpkg: si falla, se vuelve a lite.

### ADR-009 · Parámetros de análisis
- **Decisión:**
  - Profundidad 16 en multihilo y 12 en un hilo o móvil.
  - MultiPV 2.
  - Hilos `min(hardwareConcurrency − 1, 4)`; hash de 64 MB (16 MB en móvil).
  - Cancelación con `stop` y un identificador por análisis.
  - Análisis progresivo: se puede recorrer lo ya analizado.
  - Caché por URL o hash del PGN + variante + profundidad + versión de esquema.
  - Los valores son constantes en el código, no opciones de la UI.
- **Consecuencias:** MultiPV 2 hace posibles «gran jugada» y «brillante». Cambiar la profundidad obliga a reanalizar.

### ADR-010 · Hosting en Cloudflare Pages
- **Decisión:** Cloudflare Pages, con `_headers` para COOP `same-origin` + COEP `require-corp`, una previsualización por PR y fallback SPA.
- **Descartado:** Vercel Hobby (no permite uso comercial; límite de 100 MB), Netlify (ahora funciona por créditos), GitHub Pages (no permite cabeceras sin trucos).
- **Consecuencias:** las imágenes y la API de chess.com envían `CORP: cross-origin` y `ACAO: *` (comprobado), así que COEP no las rompe.

### ADR-011 · % de victoria y precisión (fórmula de lichess)
- **Decisión:** exactamente la fórmula de lichess:
  - `win% = 50 + 50·(2/(1+e^(−0,00368208·cp)) − 1)`, con cp limitado a ±1000. El mate cuenta como ±1000.
  - `precisiónJugada = 103,1668·e^(−0,04354·caída) − 3,1669`, limitada a [0, 100]. La caída es la de % de victoria desde el punto de vista del bando que mueve.
  - `precisiónPartida` por bando = media de dos medias:
    - la ponderada por volatilidad (desviación típica del % de victoria en ventanas de tamaño `clamp(n/10, 2, 8)`, con pesos en [0,5, 12]);
    - y la armónica.
  - Las jugadas de libro también cuentan.
- **Descartado:** una fórmula propia.
- **Consecuencias:** se puede testear con los vectores de lichess.

### ADR-012 · Clasificación de jugadas
- **Decisión** (según la caída en % de victoria del bando que mueve):

| Etiqueta | Regla |
|---|---|
| Mejor | Es la PV1 o pierde ≤ 1 |
| Buena | Pierde ≤ 5 |
| Imprecisión | Pierde ≤ 10 |
| Error | Pierde ≤ 20 |
| Error grave | Pierde > 20 |
| Libro | La posición resultante está en lichess-org/chess-openings (CC0), que además da el nombre de la apertura |
| Gran jugada | Es la mejor y la PV2 pierde ≥ 10 |
| Brillante | Mejor o pierde ≤ 1, **y** es un sacrificio: siguiendo la PV 4 medias jugadas, el bando que mueve pierde ≥ 2 de material. Además, % de victoria tras la jugada ≥ 50 y antes < 97 |
| Oportunidad perdida | El rival acaba de cometer un error o error grave y tu jugada pierde ≥ 10 (sustituye a la etiqueta de error) |
| Única jugada legal | Sin etiqueta y sin penalización |

- **Descartado:** los umbrales de lichess (10/20/30), demasiado laxos para jugadores de club; la etiqueta «excelente»; un evaluador de intercambios estático (SEE) propio.
- **Consecuencias:** posibles falsos positivos de «brillante», marcados como `shortcut:` y a calibrar con partidas reales.

### ADR-013 · Rendimiento estimado, opcional
- **Decisión:** T5.8, que se puede recortar. Solo se hace con una regresión publicada y citable, y se muestra como «orientativo». Si no hay fuente, se cancela.

### ADR-014 · Momentos clave
- **Decisión:**
  - Cuentan las jugadas brillante, gran jugada, error grave, error u oportunidad perdida, más el punto de inflexión (el % de victoria cruza el 50 con una variación ≥ 15).
  - En orden cronológico y sin límite de cantidad.
  - Se navega con un botón y con la tecla `N`.

### ADR-015 · Metodología: skills y PR
- **Decisión:**
  - Skills de Pocock y cuándo se usan: `tdd` (dominio), `diagnosing-bugs` (bugs), `codebase-design` (interfaz del motor), `wizard` (pasos manuales), `pr` (cuerpo del PR), `writing-for-agents` (`CLAUDE.md` y subagentes).
  - PR: una tarea = un PR, como máximo ~400 líneas de código, con `verifier` y `ponytail-review` superados. Squash merge, siempre por la usuaria.
  - `main` protegida por hook + protección de rama en GitHub.
- **Descartado:** `code-review` (se solapa con ponytail-review), `prototype`, `research` y `domain-modeling`. Tampoco existen ya `setup-pre-commit`, `git-guardrails-claude-code` ni `handoff`: los sustituyen el hook `guard-git`, `simple-git-hooks` y las notas de traspaso.

### ADR-016 · Extras
- **Decisión:** statusline propia, Conventional Commits comprobados con un script en `commit-msg`, `simple-git-hooks` + `biome check --staged`, plantilla de PR, Dependabot mensual y agrupado, y `budget.json` de Lighthouse.
- **Descartado:** commitlint, Renovate, changesets y release-please.

### ADR-017 · Hitos con tracer bullet
- **Decisión:** M0 Base → M1 Tracer bullet (de punta a punta) → M2 Carga → M3 Tablero → M4 Motor → M5 Análisis → M6 Pulido → M7 v1.0.
- **Consecuencias:** el riesgo principal (el motor en el navegador y el despliegue con COOP/COEP) se valida en M1.

### ADR-018 · Modelos y tokens
- **Decisión:**
  - `sonnet` + `medium` por defecto en los settings del proyecto.
  - `opusplan` para grilling y arquitectura.
  - Advisor Opus solo en las tareas marcadas.
  - Subagentes Haiku: `explorer`, `verifier` y `mechanic`.
  - Fable nunca.
  - `/usage` al cerrar cada hito; la statusline muestra el % de las 5 h.
- **Descartado:** el advisor fijo en settings (consultaría a Opus también en tareas triviales).

### ADR-019 · Nombre: Zugzwang
- **Decisión:** el producto se llama **Zugzwang**; el repositorio, `valbuDAM/chessAnalyzer` (igual que la carpeta local, por decisión de la usuaria).

### ADR-020 · Caché de chess.com sin cabeceras condicionales
- **Contexto:** enviar `If-None-Match` a mano deja de ser una petición CORS simple y provoca un preflight `OPTIONS` que no sabemos si chess.com responde.
- **Decisión:**
  - No se envían cabeceras propias.
  - El navegador gestiona `ETag`/`max-age=60` con su caché HTTP.
  - Los meses cerrados son inmutables y se guardan en IndexedDB.
  - Las peticiones van en serie.
- **Consecuencias:** se respetan `ETag` y `Last-Modified` sin escribir código para ello, y los meses cerrados no se vuelven a pedir.

### ADR-021 · Rutas con wouter desde M1
- **Decisión:** wouter (~2 KB) con las rutas `/`, `/u/:user`, `/u/:user/:gameId` y `/pgn`. Los filtros van en la query string.
- **Descartado:** react-router (unas 10 veces más pesado) y montar las rutas más tarde (obligaría a rehacer la navegación).

### ADR-022 · Motor vendorizado
- **Contexto:** el paquete npm `stockfish` pesa 205 MB descomprimido y solo usamos unos 7 MB.
- **Decisión:** `scripts/vendor-engine.mjs` descarga de unpkg, con la versión fijada, lite multihilo, lite de un hilo y asm.js, comprueba su SHA-256 y los deja en `public/engine/`, que se sube al repo.
- **Consecuencias:** la CI es rápida y la versión, exacta. Actualizar el motor = volver a ejecutar el script. Los binarios están bloqueados para lectura por `permissions.deny`.

### ADR-023 · `AGENTS.md` de ponytail sin importar
- **Contexto:** el plugin ponytail inyecta sus reglas con su hook `SessionStart` (también tras `/clear` y `/compact`) y en los subagentes (`SubagentStart`).
- **Decisión:** `AGENTS.md` va en la raíz para otros agentes, pero **no** se importa con `@` en `CLAUDE.md`.
- **Consecuencias:** no se pagan dos veces los mismos tokens. Si se desinstala el plugin, hay que añadir `@AGENTS.md` a `CLAUDE.md`.
