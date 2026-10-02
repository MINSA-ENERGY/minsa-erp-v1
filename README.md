# MINSA ERP — app (v0.2.0, fase 4: arranque de pantallas)

PWA del ERP de MINSA ENERGY (`erp.minsaenergy.com`). Sustituirá a MINSA Proyectos: mismo login de Entra
(se **reusa su app registration**), mismas listas `PROY_*` del sitio Administración, cara nueva. El plan vive en
`../docs/plan.md`; v0.1.0 fue su fase 3 (el motor traído); **v0.2.0 arranca la fase 4** con la maqueta aprobada el
2026-10-01 (forma) y `esquema.json` (nombres de datos).

## De dónde sale el motor

Copiado de `minsa-proyectos-app/app` **v0.160.0, commit `2489517`** (2026-10-01):

| Traído tal cual | Ajustado | Nuevo en el ERP |
|---|---|---|
| `graph.js` · `reglas.js` · `lote.js` · `esquema.json` · `servidor-local.js` · `minsa-ui.css` · `vendor/` · `iconos/` · `marca/` · `_config.yml` · `.gitignore` · `.gitattributes` · `test/reglas.test.js` · `test/lote.test.js` · `test/vendor-vigente.js` | `comun.js` (VERSION; **v0.2.0: arreglo de `mesDia`**, ver abajo) · `config.js` (+`redirectProduccion`) · `sw.js` (caché `minsa-erp-v2`) · `manifest.json` · `CNAME` · `package.json` · `test/sw.test.js` · `test/datos.test.js` · `test/e2e.ps1` | `index.html` · `app.js` · `pantallas.js` (v0.2.0) · `estilo.css` · `test/pruebas.html` |

**No se trajeron** las vistas de Proyectos (`vistas.js`, `tablero.js`, `capital.js`, `chat.js`, `docs.js`): se leyeron
como referencia de qué campos pinta cada pantalla, y las del ERP se escriben nuevas en `pantallas.js`.

- `estilo.css` = fuentes + paleta + shim de tokens de Proyectos, con los **valores de color de la maqueta** (claro
  `#f7f8fa`/`#111111`, oscuro azul noche `#0b1220`/`#131c2c`, marca `#69c6ff` en oscuro) sobre los mismos nombres, más el
  acomodo de v0.2.0 (rail 264 px → pestañas abajo a ≤ 720 px, Saira 600 en títulos, Barlow en el texto).
- `lote.js` conserva `APP = 'minsa-proyectos'` **a propósito**: `recibo-lote.py` (skills de archivar) solo emite
  recibo para esa app. Cambiarlo es decisión de la pantalla Archivos, de la mano del script.
- `esquema.json` **no cambia** (decisión 6 del plan: mismas `PROY_*` mientras Proyectos viva).
- **`comun.js` `mesDia` (v0.2.0):** un día suelto `YYYY-MM-DD` se volvía a pasar por `diaDe` (medianoche UTC = día
  anterior en México), así que `fechaVence` —y con ella `chipVence`— decía «venció 27 sep» de una tarjeta del 28. El
  bug **viene de Proyectos v0.160.0 y allá sigue** (no se tocó Proyectos). Lo caza la E2E («la hoja de calendario y el
  chip dicen el mismo día»).

## Qué hace hoy (v0.2.0) — solo lectura

| Ruta | Pantalla |
|---|---|
| `#inicio` (y todo hash desconocido) | Saludo + **Mis pendientes**: tareas abiertas de `PROY_Tareas` con `Asignado` = yo, agrupadas por vencimiento (vencidas · hoy · esta semana · más adelante · sin fecha); el rail lleva el contador (`misAbiertas`, la misma función). Debajo, los proyectos activos. |
| `#proyectos` | Activos ordenados por `Vence` (por hacer / en curso / hechas por tarjeta) y los cerrados plegados. |
| `#p/<clave>` | Tablero kanban del proyecto con **sus** cubetas (`Columnas`, o las 4 default) y una «Sin cubeta» si alguna tarjeta quedó en una borrada. **Solo lectura**: crear y mover tarjetas sigue en MINSA Proyectos (lo dice un botón deshabilitado). |
| `#archivos` · `#gastos` · `#equipo` | «En construcción», honestas: qué falta y dónde se hace hoy (Equipo lista ya las personas de `PROY_Roles`). |

Mismo formato de hash que Proyectos, así sus ligas `#p/<clave>` abren aquí. Tema: sin elección manda
`prefers-color-scheme`; los botones Claro/Oscuro (en celular, «Tema» arriba) fijan `data-theme` y se recuerdan en
`localStorage` (`erp.tema`, en try). Planta CALYTEK y Tablero salen en el rail como «próximamente» (ocultos en celular).
Lee `PROY_Proyectos`, `PROY_Tareas` y `PROY_Roles`; **no escribe nada**.

## Pruebas

```
npm test            # piel al día, selectores, comentarios, reglas (214), lote (27), sw, datos
npm run test:e2e    # PowerShell + Edge headless, 3 roles (gerencia · colaborador · lectura): 45 por rol
node ../herramientas-dev/capturas.mjs --salida ../docs/capturas/v<versión>   # 390/1366 × claro/oscuro, mide desborde
```

La E2E (`test/pruebas.html`) reusa **literal** el MSAL falso, el Graph falso y la bitácora del arnés de Proyectos.
Escenarios de v0.2.0: entrada y rol, rail (5 destinos + 2 próximamente, `aria-current`, contador), grupos de Mis
pendientes con fechas en hora de México, un título con HTML pintado como texto, de un pendiente a su proyecto, kanban
con cubetas default/propias/«Sin cubeta», lista de proyectos, clave inexistente, las tres «en construcción», hash
desconocido, tema claro/oscuro con el color de fondo medido, y cero escrituras.

Capturas de v0.2.0: `../docs/capturas/v0.2.0/` (Inicio y Proyecto, 390 y 1366, claro y oscuro; `_mediciones.txt`:
overflowX = 0 en las 8).

La capa privada de `datos.test.js` lee `../herramientas-dev/datos-prohibidos.txt` (copia de la de Proyectos, fuera
de este repo).

## Qué falta

- Fase 4, lo que sigue: mover/crear/editar tarjetas en el kanban (escrituras con If-Match, como Proyectos), la ficha de
  la tarjeta, la pantalla Archivos (subida al buzón) y la vista de Equipo.
- Remoto: repo público en la org MINSA-ENERGY + GitHub Pages (decidido; **sin crear**, este repo no tiene remoto).
- Medir el login real en `erp.minsaenergy.com` (la redirect URI la agregó Carlos en Entra, dicho por él, no medido).
- Fase 5: lista y biblioteca «Gastos».

## Qué prueban las capturas de v0.2.0 (revisor-entregable, 2026-10-01)

- `docs/capturas/v0.2.0/` sale del **Graph falso de `test/pruebas.html`** («Persona de Prueba», «LAU CALYTEK (demo)», una tarea con `<img onerror>` sembrada a propósito para probar el escape). **Ninguna captura usa datos reales.**
- Las 8 capturas son del rol **gerencia**. La E2E sí corre los tres roles (45/0 cada uno), pero no hay capturas de colaborador ni de lectura.
- La regla de escribir una vez en real en cada lista **no aplica a v0.2.0**, que es solo lectura. Aplica desde la primera versión que escriba (mover/crear tarjetas, gastos).
- IBM Plex Mono (`--f-data`) está declarada y todavía no se usa: es solo para montos, y aún no hay pantalla de montos.
