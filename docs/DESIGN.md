# Diseño — «club clásico reinventado»

La sala de un club de ajedrez antiguo: mesas de nogal, herrajes de latón y tapete verde. Fuente de verdad de los valores: `src/styles/tokens.css`. Muestra viva: `/styleguide` (sin enlazar, `noindex`). Decisiones: ADR-004 y ADR-024.

## Reglas

- Ningún color, tamaño ni duración fuera de `tokens.css`. Si falta uno, se añade allí y aquí.
- El latón (`--color-accent`) es escaso: marca, foco, marcos y el estado activo. No se usa para rellenar superficies.
- El fieltro y el tablero son iguales en los dos temas: la mesa es la mesa.
- El significado nunca depende solo del color (glifo o texto siempre presentes).
- Sin mayúsculas sostenidas en etiquetas, sin numeraciones decorativas, sin animaciones de entrada por sección.

## Color

| Token | Oscuro (defecto) | Claro | Uso |
|---|---|---|---|
| `--color-bg` | `#1c1410` | `#e9e1cf` | Fondo de página (nogal / hueso) |
| `--color-surface` | `#261b15` | `#f3ede0` | Paneles, botones |
| `--color-raised` | `#33251c` | `#ddd3be` | Paneles elevados, marco de la mesa |
| `--color-text` | `#efe4cf` | `#2a1d15` | Texto principal |
| `--color-text-muted` | `#bca98c` | `#5e4b3a` | Texto secundario |
| `--color-accent` | `#d4a84b` | `#6e4f0f` | Latón |
| `--color-focus` | `#e8c766` | `#6e4f0f` | Anillo de foco |
| `--color-felt` | `#1e4a38` | = | Tapete bajo el tablero |
| `--color-on-felt` / `-muted` | `#efe4cf` / `#d0bb9a` | = | Texto sobre el tapete |
| `--color-board-light` / `-dark` | `#d9c7a0` / `#3f6a54` | = | Casillas (boj / fieltro) |

Contraste medido (WCAG): texto principal ≥ 12,5:1; secundario ≥ 5,5:1; latón ≥ 4,8:1 sobre todos sus fondos; texto sobre fieltro ≥ 5,3:1; coordenadas ≥ 4,9:1. Axe lo comprueba en CI en los dos temas (`tests/e2e/styleguide.spec.ts`).

## Etiquetas de jugada

El matiz da el tono; el glifo, el significado. Glifo en `--color-on-label` (`#1c1410`) salvo «error grave» (`--color-on-label-strong`). Todos ≥ 5,3:1.

| Etiqueta | Marca | Color |
|---|---|---|
| Brillante | `!!` | `#e8c766` |
| Gran jugada | `!` | `#9c86d6` |
| Mejor | estrella | `#5db585` |
| Buena | visto | `#a3b596` |
| Libro | libro | `#b08a64` |
| Imprecisión | `?!` | `#e49b3f` |
| Error | `?` | `#e0663e` |
| Error grave | `??` | `#b4283a` |
| Oportunidad perdida | aspa | `#d46a9c` |

Componente: `src/ui/MoveBadge.tsx` (`role="img"` con el nombre como etiqueta accesible).

## Tipografía

- **Young Serif** (`--font-display`, un solo peso): títulos, nombres de apertura, cifras grandes.
- **Atkinson Hyperlegible Next** (`--font-ui`, variable): todo lo demás. Cifras tabulares (`tabular-nums`) en evaluaciones y precisión.
- Escala (rem): 0,875 · 1 · 1,125 · 1,3125 · 1,5 · 2,25 · 3 · display `clamp(3, 9vw, 4.5)`. Interlineado 1,45 en interfaz, 1,6 en serif corrida, 1,1 en títulos. Medida ≤ 68ch.
- Fuentes autoalojadas vía `@fontsource`, subconjunto latino: ~61 KB (presupuesto 120 KB).

## Espacio, radios y bordes

- Rejilla de 4 px: `--space-1` … `--space-8` = 4, 8, 12, 16, 24, 32, 48, 64 px.
- Radios: `--radius-sm` 2 px (barra de evaluación), `--radius-md` 6 px (paneles, botones), `--radius-round` (insignias).
- `--border-inlay` 2 px: el filete de latón (marcos, foco, separador del héroe).

## Movimiento

- `--duration-fast` 120 ms (hover) · `--duration-base` 220 ms (aparición de insignias) · `--duration-slow` 420 ms (barra de evaluación).
- `--ease-out` para desplazamientos; `--ease-spring` (con rebote) solo para la insignia que «se posa».
- Con `prefers-reduced-motion: reduce`, las tres duraciones pasan a 0 ms.
- El movimiento responde a acciones de la usuaria; nada se anima solo salvo la insignia al cargar.

## Tablero

- chessground con `chessground.base.css` y tema propio en `src/ui/Board.css`: casillas en colores planos (gradiente cónico), coordenadas en minúscula con el color de la casilla opuesta.
- Piezas **merida** (SVG en `public/pieces/merida/`).

## Atribuciones

- Piezas merida: Armando Hernández Marroquín, GPLv2+ (vía lichess-org/lila).
- Young Serif: Bastien Sozeau, OFL-1.1.
- Atkinson Hyperlegible Next: Braille Institute, OFL-1.1.
- chessground: lichess, GPL-3.0-or-later.
