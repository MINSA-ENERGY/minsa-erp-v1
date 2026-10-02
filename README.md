# MINSA ERP — app (v0.5.0, fase 4: Archivos y Equipo)

PWA del ERP de MINSA ENERGY (`erp.minsaenergy.com`). Sustituirá a MINSA Proyectos: mismo login de Entra
(se **reusa su app registration**), mismas listas `PROY_*` del sitio Administración, cara nueva. El plan vive en
`../docs/plan.md`; v0.1.0 fue su fase 3 (el motor traído); **v0.2.0 arranca la fase 4** con la maqueta aprobada el
2026-10-01 (forma) y `esquema.json` (nombres de datos).

## De dónde sale el motor

Copiado de `minsa-proyectos-app/app` **v0.160.0, commit `2489517`** (2026-10-01):

| Traído tal cual | Ajustado | Nuevo en el ERP |
|---|---|---|
| `graph.js` · `reglas.js` · `lote.js` · `esquema.json` · `servidor-local.js` · `minsa-ui.css` · `vendor/` · `iconos/` · `marca/` · `_config.yml` · `.gitignore` · `.gitattributes` · `test/reglas.test.js` · `test/lote.test.js` · `test/vendor-vigente.js` | `comun.js` (VERSION; **v0.2.0: arreglo de `mesDia`**, ver abajo) · `config.js` (+`redirectProduccion`) · `sw.js` (caché `minsa-erp-v5` desde v0.5.0) · `manifest.json` · `CNAME` · `package.json` · `test/sw.test.js` · `test/datos.test.js` · `test/e2e.ps1` | `index.html` · `app.js` · `pantallas.js` (v0.2.0) · `estilo.css` · `test/pruebas.html` |

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

## Qué escribe (v0.3.0) — y en qué listas

`tarjetas.js` (nuevo) porta las escrituras del tablero de Proyectos v0.160.0 (`tablero.js`) con el mismo motor
(`graph.js`: If-Match/412; `reglas.js`: `PUEDE`, `camposDeMovimiento`, `sellarAsignadoPor`; `comun.js`: `registrarActividad`).

| Acción | Dónde se hace | `PROY_Tareas` | `PROY_Actividad` (misma frase que Proyectos) |
|---|---|---|---|
| Crear | «+ Nueva tarea» → diálogo `.mn-dialog`; el botón dice qué falta («Falta el título», «Falta una fecha válida») | POST: `Title` (MAYÚSCULAS, como Proyectos v0.107.0), `ProyectoId`, `Columna`, `Asignado`, `Vence`, `Prioridad`, `Orden`, `Descripcion`, `Desde`, `HechoPor/HechoEl` si nace en hecho, `AsignadoPor` si la lista lo tiene | `crear-tarea` «creó «X» para Y» |
| Mover | Arrastrar a otra cubeta (escritorio) o «Mover a» en la ficha (celular y teclado) | PATCH con If-Match: `Columna`, `Desde`, `HechoPor/HechoEl` (sella al entrar a hecho, `null` al salir) | `mover-tarea` «movió «X» de A a B» |
| Editar | Ficha: título, asignado, vence, prioridad; un PATCH con **solo lo que cambió** | PATCH con If-Match (+`AsignadoPor`) | `editar-tarea` «asignó «X» a Y» / «editó «X»» |
| Borrar | Ficha, solo gerencia, dos toques | DELETE; suelta `TareaId` de sus `PROY_Ligas` (best-effort) | `borrar-tarea` «borró «X»» (sin `TareaId`) |

- **Roles** (`PUEDE`): lectura no escribe (ni forzando la función: la E2E lo prueba) y ve la ficha deshabilitada;
  colaborador crea, edita y mueve; solo gerencia borra. Proyecto cerrado: nada se escribe.
- **412**: no se pisa — se releen las listas (`fijarReleer` en app.js), se avisa y la ficha abierta se repinta con lo nuevo.
- **Esquema**: no cambia; la E2E coteja cada campo escrito contra `esquema.json` (PROY_Tareas y PROY_Actividad).
- Lo que el ERP **no** porta todavía de la ficha de Proyectos: color en edición, subir/bajar orden, «crear y otra». Se editan
  en MINSA Proyectos. (Descripción, notas y documentos llegaron en v0.5.0, abajo.)
- **PENDIENTE de Carlos — escribir una vez en real por lista.** Desde aquí no hay tenant: nada de esto se ha escrito contra
  SharePoint real. Antes de usarlo en serio hay que crear, mover, editar y borrar una tarjeta de prueba en `PROY_Tareas`
  (y ver los 4 renglones en `PROY_Actividad`, y que Proyectos los pinte igual).

## Qué hace (lectura, desde v0.2.0; Archivos y Equipo en v0.5.0, abajo)

| Ruta | Pantalla |
|---|---|
| `#inicio` (y todo hash desconocido) | Saludo + **Mis pendientes**: tareas abiertas de `PROY_Tareas` con `Asignado` = yo, agrupadas por vencimiento (vencidas · hoy · esta semana · más adelante · sin fecha); el rail lleva el contador (`misAbiertas`, la misma función). Debajo, los proyectos activos. |
| `#proyectos` | Activos ordenados por `Vence` (por hacer / en curso / hechas por tarjeta) y los cerrados plegados. |
| `#p/<clave>` | Tablero kanban del proyecto con **sus** cubetas (`Columnas`, o las 4 default) y una «Sin cubeta» si alguna tarjeta quedó en una borrada (no recibe arrastres). Desde v0.3.0 se escribe (arriba). |
| `#gastos` | «En construcción», honesta: qué falta (fase 5). **`#archivos` y `#equipo` dejaron de serlo en v0.5.0** (abajo). |

Mismo formato de hash que Proyectos, así sus ligas `#p/<clave>` abren aquí. Tema: sin elección manda
`prefers-color-scheme`; los botones Claro/Oscuro (en celular, «Tema» arriba) fijan `data-theme` y se recuerdan en
`localStorage` (`erp.tema`, en try). Planta CALYTEK y Tablero salen en el rail como «próximamente» (ocultos en celular).
Lee `PROY_Proyectos`, `PROY_Tareas`, `PROY_Roles` (y las columnas reales de `PROY_Tareas`) y, desde v0.5.0, `PROY_Ligas` y `PROY_Actividad` (acotada a 90 días); escribe lo de las tablas de arriba y de v0.5.0.

## Pruebas

```
npm test            # piel al día, selectores, comentarios, reglas (214), lote (27), sw, datos
npm run test:e2e    # PowerShell + Edge headless, 3 roles: v0.5.0 = gerencia 143 · colaborador 142 · lectura 86 (v0.4.0: 83 · 82 · 54)
node ../herramientas-dev/capturas.mjs --salida ../docs/capturas/v<versión>   # 390/1366 × claro/oscuro, mide desborde
```

La E2E (`test/pruebas.html`) reusa **literal** el MSAL falso, el Graph falso y la bitácora del arnés de Proyectos.
Escenarios de v0.2.0: entrada y rol, rail (5 destinos + 2 próximamente, `aria-current`, contador), grupos de Mis
pendientes con fechas en hora de México, un título con HTML pintado como texto, de un pendiente a su proyecto, kanban
con cubetas default/propias/«Sin cubeta», lista de proyectos, clave inexistente, las «en construcción» (desde v0.5.0 solo Gastos), hash
desconocido, tema claro/oscuro con el color de fondo medido, y cero escrituras.

Capturas de v0.2.0: `../docs/capturas/v0.2.0/` (Inicio y Proyecto, 390 y 1366, claro y oscuro; `_mediciones.txt`:
overflowX = 0 en las 8).

La capa privada de `datos.test.js` lee `../herramientas-dev/datos-prohibidos.txt` (copia de la de Proyectos, fuera
de este repo).

## Qué falta

- Escribir una vez en real por lista (PENDIENTE de Carlos, arriba).
- Fase 4, lo que sigue (no cupo en v0.5.0): en la ficha, color, subir/bajar orden y «crear y otra»; en Archivos, mover una
  liga a otra tarjeta (F1 de Proyectos) y el árbol plegable de expediente (v0.33.0); borrar una nota.
- **Escribir una vez en real en `PROY_Ligas`** (subir un lote al buzón de CALYTEK, ligar, pegar enlace, quitar) y ver que
  Proyectos lo pinta igual y que `/archivar-calytek` reconoce el lote (PENDIENTE de Carlos, como el de `PROY_Tareas`).
- Remoto: repo público en la org MINSA-ENERGY + GitHub Pages (decidido; **sin crear**, este repo no tiene remoto).
- Medir el login real en `erp.minsaenergy.com` (la redirect URI la agregó Carlos en Entra, dicho por él, no medido).
- Fase 5: lista y biblioteca «Gastos».

## Qué prueban las capturas de v0.2.0 (revisor-entregable, 2026-10-01)

- `docs/capturas/v0.2.0/` sale del **Graph falso de `test/pruebas.html`** («Persona de Prueba», «LAU CALYTEK (demo)», una tarea con `<img onerror>` sembrada a propósito para probar el escape). **Ninguna captura usa datos reales.**
- Las 8 capturas son del rol **gerencia**. La E2E sí corre los tres roles (45/0 cada uno), pero no hay capturas de colaborador ni de lectura.
- La regla de escribir una vez en real en cada lista **no aplica a v0.2.0**, que es solo lectura. Aplica desde la primera versión que escriba (mover/crear tarjetas, gastos).
- IBM Plex Mono (`--f-data`) está declarada y todavía no se usa: es solo para montos, y aún no hay pantalla de montos.

## Capturas de v0.3.0

`../docs/capturas/v0.3.0/`: Inicio, Proyecto, **Nueva tarea** (diálogo abierto) y **ficha** de tarjeta, a 390 y 1366, claro y
oscuro, para **gerencia y colaborador** (32 PNG; `_mediciones.txt`: overflowX = 0 y fuera-de-ancho = 0 en las 32, la
medición ya incluye el diálogo abierto). Mismo Graph falso: ningún dato real. Las fotos son del estado DESPUÉS de la E2E
(por eso aparecen «INFORME DE PRUEBA» y «Cambiada por alguien más»). `herramientas-dev/capturas.mjs` suma las vistas
`nueva` y `ficha`.

## v0.4.0 (2026-10-01) — decisiones de Carlos al cierre de v0.3.0

- **Sin iniciales en las tarjetas del kanban**: solo el nombre corto. Carlos quitó los avatares de toda la app de Proyectos
  en su v0.61.0 («no me gusta como se ve»). `iniciales()` sigue en `reglas.js` (probada) por si el chat la pide.
  Revertir: devolver el `span.av` en `tarjetaKanban` (`pantallas.js`) y la regla `.av` de `estilo.css`.
- **En celular, Tema y Salir dentro de «···»** arriba a la derecha (como `Celular.dc.html` de la maqueta): abajo de 720 px
  el rail con Salir se oculta y no había cómo cerrar sesión en un celular compartido. Es un `<details>` que se cierra al
  elegir, al tocar fuera o con Esc. Capturas a 390 px en `../docs/capturas/v0.4.0/` (vista `mas` = menú abierto).

## v0.5.0 (2026-10-01) — Archivos y Equipo (fase 4, paridad con Proyectos)

### Qué hace

| Dónde | Qué |
|---|---|
| `#archivos` | Todo lo ligado en `PROY_Ligas`, agrupado por proyecto, con filtro de proyecto, tipo (archivado · en el buzón · enlace) y texto; «dónde quedó» (biblioteca › carpeta, o el sitio del enlace); «Qué documentos faltan» por proyecto activo con su botón a Documentos; **Subir** eligiendo proyecto (solo los activos con biblioteca autorizada). Aquí no se quita (como `#archivos` de Proyectos). |
| `#p/<clave>/docs` (pestaña **Documentos**, con «faltan N») | Subir · Ligar archivado · Pegar enlace; **Qué documentos faltan** = tarjetas abiertas sin ninguna liga (el nodo «tarjetas sin documentos» del expediente de Proyectos), cada una con sus tres botones; los documentos agrupados («Del proyecto» y por tarjeta) con **Quitar**; el lote cuya carpeta ya no está en el buzón dice «ya lo acomodó la skill» y, si la skill dejó recibo, la liga se reemplaza sola (`aplicarRecibo`). |
| `#equipo` | Personas activas de `PROY_Roles`: rol, pendientes abiertos (`misAbiertas`) y **«Escribió en la app»** = renglones de `PROY_Actividad` firmados por la persona (`Quien`) en los últimos `CONFIG.actividadDias` (90), con cuántos y la última fecha; arriba «N de M» y la meta del plan (6 de 10 a 6 semanas de compartir). Cuenta lo escrito desde Proyectos también (misma bitácora). Sin avatares. |
| Ficha de tarjeta | Suma **Descripción** (editable, viaja en el mismo PATCH con solo lo que cambió), **Documentos** de la tarjeta (con Quitar y Subir/Ligar/Enlace con la tarjeta puesta; la ficha cede el paso al diálogo y vuelve al guardar o cancelar) y **Notas** (las de `PROY_Actividad` `Accion=comentar`; anotar si el rol edita). |

Código nuevo en `archivos.js` (portado de `docs.js` de Proyectos v0.160.0: mismas funciones de guardar, mismos chequeos de rol,
mismo `_lote.json`); Equipo en `pantallas.js`; la ficha en `tarjetas.js`. `cargarTodo` ahora lee también `PROY_Ligas` y
`PROY_Actividad` acotada por `Cuando` (como Proyectos v0.13.1; si el filtro da 400, entera).

### Qué escribe y en qué listas

| Acción | SharePoint | `PROY_Actividad` (misma frase que Proyectos) |
|---|---|---|
| Subir | Biblioteca de la unidad: carpeta del lote en `99_Pendiente-Archivar/` → piezas → `_lote.json` al final (si falla a medias se borra la carpeta). `PROY_Ligas` POST `Tipo=buzon` | `subir` «subió «X» al buzón (N archivo(s))» |
| Ligar archivado | Lee la biblioteca (búsqueda fuera del buzón + relectura por id). `PROY_Ligas` POST `Tipo=archivado` (Url acortada a 255) | `ligar` «ligó «X»» |
| Pegar enlace | `PROY_Ligas` POST `Tipo=enlace` (solo http(s)) | `ligar` «pegó el enlace «X»» |
| Quitar | `PROY_Ligas` DELETE (con confirmación; el archivo no se toca) | `desligar` «desligó «X»» |
| Recibo de la skill | `PROY_Ligas` POST por pieza + DELETE de la liga buzon; borra el recibo de `_resueltos/` | `ligar` … «(archivado por la skill)» y `desligar` «reemplazó la liga…» |
| Anotar | `PROY_Actividad` POST `Accion=comentar` con `ProyectoId` y `TareaId` | (es el propio renglón) |
| Descripción | `PROY_Tareas` PATCH con If-Match, solo `Descripcion` (vacía = null) | `editar-tarea` «editó «X»» |
| Borrar tarjeta (ya existía) | además refleja en memoria el `TareaId: null` de sus ligas | — |

- **Roles** (`PUEDE.ligar`): lectura no sube, no liga, no pega, no quita, no anota — ni forzando las funciones (la E2E lo
  prueba); colaborador y gerencia sí. Subir/Ligar exigen biblioteca **autorizada** (`piloto` de `config.js`); sin ella, el
  botón dice por qué y solo queda Pegar enlace. Proyecto cerrado: nada se escribe.
- **Esquema**: no cambia (decisión 6); la E2E coteja cada campo escrito contra `esquema.json` (`PROY_Ligas`, `PROY_Actividad`).
- **`lote.js` sigue firmando `app: 'minsa-proyectos'`** (default elegido): `recibo-lote.py` e `inventario-buzon.py` solo
  reconocen esa app. Cambiarlo a `minsa-erp` es de la mano de esos dos scripts.
- **Default elegido**: «Escribió en la app» cuenta TODO renglón de la persona en la ventana de 90 días, incluido el ✓ «visto»
  de Proyectos. Revertir/ajustar: el filtro en `escriturasPorPersona` (`pantallas.js`).

### Cómo revertir

`git revert` del commit de v0.5.0 en este repo (no toca datos). Por partes: quitar `archivos.js` (y su import en `app.js`,
`pantallas.js`, `tarjetas.js`, su renglón en `sw.js`), devolver `archivos`/`equipo` a `EN_CONSTRUCCION` en `pantallas.js`, y
quitar del `<dialog id="dlgFicha">` las secciones `fDesc`/`fDocs`/`fNotas`. Lo que ya se haya escrito en real (ligas, lotes,
notas) queda en SharePoint y Proyectos lo sigue pintando: es el mismo formato.

### Capturas

`../docs/capturas/v0.5.0/`: inicio, proyecto, **archivos**, **equipo**, **docs** (pestaña Documentos) y **ficha**, a 390 y 1366,
claro y oscuro, rol gerencia (24 PNG; `_mediciones.txt`: overflowX = 0 y fuera-de-ancho = 0 en las 24). Graph falso: ningún
dato real; fotos del estado DESPUÉS de la E2E (por eso «INFORME DE PRUEBA», el lote «Informe de campo» y «Persona · Sí · 14»).
