# Zugzwang — CLAUDE.md

Analizador de partidas de chess.com con Stockfish 19 en el navegador (WASM), sin servidor de análisis. Una sola desarrolladora, plan Pro: **cada token cuenta**.

- **Idioma:** conversación y docs en español; código, identificadores y commits en inglés.
- **Stack:** Vite + React 19 + TS estricto · chessops (reglas/PGN) · chessground (tablero) · SVG propio (gráfico) · i18next · idb-keyval · wouter · Biome · Vitest + Testing Library · Playwright + axe · GitHub Actions · Cloudflare Pages. Licencia GPL-3.0.
- **Fuentes de verdad:** progreso → `docs/ROADMAP.md` · decisiones → `docs/DECISIONS.md` (no reabrir una ADR sin grilling) · diseño → `docs/DESIGN.md` (desde T0.5).
- **Ponytail:** su plugin inyecta las reglas en cada sesión (hook `SessionStart`), así que `AGENTS.md` **no** se importa aquí con `@`: sería pagarlo dos veces. Está en la raíz para otros agentes. Modo por defecto: `full`.

## Comandos (existen a partir de T0.1)

| Qué | Comando |
|---|---|
| Desarrollo | `npm run dev` |
| Lint + formato | `npm run lint` (`npm run lint:fix` para arreglar) |
| Tipos | `npm run typecheck` |
| Tests unitarios/componente | `npm test` (`-- --coverage` para cobertura) |
| Build | `npm run build` |
| e2e | `npm run e2e` |
| Mutation testing (cierre de hito) | `npm run mutate` |

## Regla de oro

**Al empezar cada sesión y al terminar cada tarea, di a la usuaria cuál es el siguiente paso**, leído de `▶ Siguiente tarea` en el roadmap, con el comando literal de modelo/esfuerzo/advisor/contexto si toca cambiarlo. Nunca termines un turno de trabajo sin decirlo.

## Flujo por tarea

1. Lee `▶ Siguiente tarea` y su bloque en el roadmap (el hook de inicio ya lo inyecta). Di qué tarea es y su modelo/esfuerzo/advisor; si no coincide con el actual, da el comando exacto y espera.
2. ¿Ambigüedad, arquitectura, UX nueva, dependencia nueva o algo caro de deshacer? → skill **grilling** antes de tocar código.
3. Rama `feat/txx-slug` (o `fix/`, `chore/`) desde `main` actualizado: `git switch main && git pull && git switch -c feat/t1-4-engine`.
4. Lógica de dominio → skill **tdd** (rojo → verde → refactor). Dominio en `src/domain/` sin React ni DOM; motor simulado (`FakeEngine`) en unitarios; API de chess.com simulada con MSW o `page.route`.
5. Implementa con ponytail. Si toca UI → skill **frontend-design**, usando los tokens de `src/styles/tokens.css` (nunca colores/tamaños sueltos).
6. Subagente **verifier** → todo en verde (incluido e2e si la tarea toca un flujo).
7. Skill **ponytail-review** → corrige los hallazgos y repite 6 si cambias código.
8. Commits Conventional (`feat(engine): …`), push, PR con `gh pr create` y la skill **pr** para el cuerpo (qué, por qué, cómo probarlo, criterios de aceptación marcados).
9. CI en verde → recuerda a la usuaria: revisar (en UI, la URL de preview de Cloudflare) y hacer **squash merge**.
10. Tras el merge: actualiza el roadmap (estado, notas de traspaso, `▶ Siguiente tarea`), di el siguiente paso y si toca `/clear`.

## Automatización

| Momento | Qué | Cómo |
|---|---|---|
| Inicio de sesión, `/clear`, `/compact` | Rama, siguiente tarea y notas de traspaso | Hook `SessionStart` (automático) |
| Inicio de sesión | Reglas de ponytail `full` | Hook del plugin ponytail (automático) |
| Tras cada Edit/Write | Formateo con Biome | Hook `PostToolUse` (automático) |
| Push a `main`, `--force`, `--no-verify`, `reset --hard`, commit en `main` | Bloqueo | Hook `PreToolUse` + protección de rama en GitHub (automático) |
| Commit | `biome check --staged` + formato Conventional | `simple-git-hooks` (automático, desde T0.1) |
| Siempre | Modelo, % contexto, % 5 h, tarea, rama | Statusline (automático) |
| Leer `node_modules`, `dist`, `.wasm`, lockfile… | Prohibido | `permissions.deny` (automático) |
| Búsqueda que abarca varios archivos | Subagente **explorer** (Haiku) | Instrucción: úsalo siempre en vez de leer a ciegas |
| Lint/tipos/tests/build | Subagente **verifier** (Haiku) | Instrucción: antes de cada PR y tras cambios grandes |
| Cambio mecánico totalmente especificado | Subagente **mechanic** (Haiku) | Instrucción: tareas marcadas `haiku` o pasos mecánicos |
| Roadmap, ambigüedad, arquitectura, irreversible | Skill **grilling** | Instrucción (obligatorio) |
| Crear o cambiar UI | Skill **frontend-design** | Instrucción (obligatorio) |
| Lógica de dominio | Skill **tdd** | Instrucción |
| Bug, test que falla 2 veces, regresión | Skill **diagnosing-bugs** | Instrucción |
| Diseñar la interfaz del motor (T1.4) | Skill **codebase-design** | Instrucción |
| Pasos que solo puede hacer la usuaria | Skill **wizard** | Instrucción |
| Cuerpo del PR | Skill **pr** | Instrucción |
| Editar `CLAUDE.md` o subagentes | Skill **writing-for-agents** | Instrucción |
| Antes de cada PR | Skill **ponytail-review** | Instrucción (obligatorio, debe pasar) |
| Cierre de hito | **ponytail-audit**, **ponytail-debt**, `npm run mutate`, e2e Firefox/WebKit | Instrucción (checklist en el roadmap) |
| Cierre de hito | Revisar `/usage` | **Recordar a la usuaria** |
| Cambio de modelo/esfuerzo/advisor | `/model`, `/effort`, `/advisor` | **Recordar a la usuaria** con el comando literal |
| Contexto alto / cambio de tarea | `/compact …` / `/clear` | **Recordar a la usuaria** (ver Contexto) |
| Plugins nuevos o actualizados | `/reload-plugins` | **Recordar a la usuaria** |
| Merge del PR, acciones en Cloudflare/GitHub | Manual | **Recordar a la usuaria** (con `wizard` si son varios pasos) |

## Modelos y tokens

- **Por defecto** (fijado en `.claude/settings.json`): `sonnet`, esfuerzo `medium`. Cada sesión arranca así.
- **`/model opusplan` + plan mode:** grilling, cambios del roadmap, decisiones de arquitectura y tareas marcadas `opusplan`. Al acabar: `/model sonnet`.
- **Advisor:** solo en tareas marcadas `advisor sí` (cola del motor, fórmulas, clasificación) o ante un error que se repite: `/advisor opus` al empezar y `/advisor off` al cerrar. Nunca fijo en settings.
- **Esfuerzo:** `/effort low` en tareas mecánicas/docs · `medium` por defecto · `/effort high` en motor, fórmulas y bugs difíciles. `xhigh`/`max` solo si la usuaria lo pide.
- **Haiku:** solo vía subagentes (`explorer`, `verifier`, `mechanic`).
- **Fable:** nunca (en Pro puede cobrar créditos aparte).
- Cada tarea del roadmap lleva su modelo/esfuerzo/advisor. Al empezarla, compáralo con el actual y da el comando si difiere.

## Contexto

- Misma tarea y el contexto pasa del ~60 % (la statusline avisa): pide a la usuaria `/compact conserva Txx, decisiones tomadas, archivos tocados y qué falta`.
- Cambio de tarea: **antes** actualiza las notas de traspaso del roadmap y luego pide `/clear`.
- Nunca leas archivos enteros si basta un rango; nunca repitas en el chat el contenido de un archivo; búsquedas amplias → `explorer`; salidas largas de tests → `verifier`.

### Compact instructions

Al compactar, conserva: la tarea en curso (ID y criterios de aceptación pendientes), las decisiones tomadas en esta sesión que aún no están en `DECISIONS.md`, los archivos tocados, los fallos abiertos y el siguiente paso. Descarta: salidas de tests y builds, contenido de archivos ya leídos, exploraciones sin resultado.

## Criterios de PR

- **Una tarea = un PR.** Si el diff pasa de ~400 líneas de código (sin contar tests, lockfile, `src/i18n/*.json`, datos ni binarios del motor), divide la tarea en el roadmap (T1.4a, T1.4b) antes de seguir.
- Nunca push a `main`. Solo se abre el PR con `verifier` en verde y `ponytail-review` superado.
- CI de GitHub Actions obligatoria: lint, typecheck, tests con cobertura (≥ 90 % ramas en `src/domain/`), build, e2e Chromium + móvil con axe.
- **Squash merge**, siempre por la usuaria. Título del PR = mensaje Conventional del squash.

## Convenciones de código

- `src/domain/` → lógica pura y testeada (PGN, API, motor, precisión, clasificación). `src/ui/` → componentes React. `src/i18n/` → textos. `tests/fixtures/` → datos reales recortados.
- Todo texto visible sale de `src/i18n/es.json`. Todo color, tamaño o duración sale de `tokens.css`.
- Accesibilidad no negociable: WCAG 2.2 AA, teclado completo, `prefers-reduced-motion`.
- Atajo con límite conocido → comentario `shortcut: <límite>, <cuándo mejorarlo>` (lo recoge `ponytail-debt`).

## Plugins requeridos

`frontend-design@claude-plugins-official`, `mattpocock-skills@claude-plugins-official` (se usa `grilling`, no `grill-me`), `ponytail@ponytail`. Si falta alguno, dile a la usuaria el comando `/plugin install …` y luego `/reload-plugins`.
