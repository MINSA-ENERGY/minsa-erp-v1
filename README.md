# MINSA ERP — app (v0.9.0, paridad de Archivos con Proyectos: el árbol en `#archivos`)

PWA del ERP de MINSA ENERGY (`erp.minsaenergy.com`). Sustituirá a MINSA Proyectos: mismo login de Entra
(se **reusa su app registration**), mismas listas `PROY_*` del sitio Administración, cara nueva. El plan vive en
`../docs/plan.md`; v0.1.0 fue su fase 3 (el motor traído); **v0.2.0 arranca la fase 4** con la maqueta aprobada el
2026-10-01 (forma) y `esquema.json` (nombres de datos).

## De dónde sale el motor

Copiado de `minsa-proyectos-app/app` **v0.160.0, commit `2489517`** (2026-10-01):

| Traído tal cual | Ajustado | Nuevo en el ERP |
|---|---|---|
| `graph.js` · `reglas.js` · `lote.js` · `esquema.json` · `servidor-local.js` · `minsa-ui.css` · `vendor/` · `iconos/` · `marca/` · `_config.yml` · `.gitignore` · `.gitattributes` · `test/reglas.test.js` · `test/lote.test.js` · `test/vendor-vigente.js` | `comun.js` (VERSION; **v0.2.0: arreglo de `mesDia`**, ver abajo) · `config.js` (+`redirectProduccion`) · `sw.js` (caché `minsa-erp-v<minor>`: `minsa-erp-v9` desde v0.9.0) · `manifest.json` · `CNAME` · `package.json` · `test/sw.test.js` · `test/datos.test.js` · `test/e2e.ps1` | `index.html` · `app.js` · `pantallas.js` (v0.2.0) · `estilo.css` · `test/pruebas.html` |

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
- ~~Lo que el ERP no portaba de la ficha de Proyectos: color en edición, subir/bajar orden, «crear y otra»~~: llegaron en
  **v0.8.0** (abajo). (Descripción, notas y documentos llegaron en v0.5.0.)
- **PENDIENTE de Carlos — escribir una vez en real por lista.** Desde aquí no hay tenant: nada de esto se ha escrito contra
  SharePoint real. Antes de usarlo en serio hay que crear, mover, editar y borrar una tarjeta de prueba en `PROY_Tareas`
  (y ver los 4 renglones en `PROY_Actividad`, y que Proyectos los pinte igual).

## Qué hace (lectura, desde v0.2.0; Archivos y Equipo en v0.5.0, abajo)

| Ruta | Pantalla |
|---|---|
| `#inicio` (y todo hash desconocido) | Saludo + **Mis pendientes**: tareas abiertas de `PROY_Tareas` con `Asignado` = yo, agrupadas por vencimiento (vencidas · hoy · esta semana · más adelante · sin fecha); el rail lleva el contador (`misAbiertas`, la misma función). Debajo, los proyectos activos. |
| `#proyectos` | Activos ordenados por `Vence` (por hacer / en curso / hechas por tarjeta) y los cerrados plegados. |
| `#p/<clave>` | Tablero kanban del proyecto con **sus** cubetas (`Columnas`, o las 4 default) y una «Sin cubeta» si alguna tarjeta quedó en una borrada (no recibe arrastres). Desde v0.3.0 se escribe (arriba). |
| `#gastos` · `#gastos/tesoreria` | **Desde v0.6.0**: registrar un gasto, «Mis gastos» y, para tesorería, la cola por reembolsar (abajo). Mientras `ERP_Gastos` no exista en el sitio, dice «Gastos aún no está habilitado — falta crear la lista». |

Mismo formato de hash que Proyectos, así sus ligas `#p/<clave>` abren aquí. Tema: sin elección manda
`prefers-color-scheme`; los botones Claro/Oscuro (en celular, «Tema» arriba) fijan `data-theme` y se recuerdan en
`localStorage` (`erp.tema`, en try). Planta CALYTEK y Tablero salen en el rail como «próximamente» (ocultos en celular).
Lee `PROY_Proyectos`, `PROY_Tareas`, `PROY_Roles` (y las columnas reales de `PROY_Tareas`) y, desde v0.5.0, `PROY_Ligas` y `PROY_Actividad` (acotada a 90 días); escribe lo de las tablas de arriba y de v0.5.0.

## Pruebas

```
npm test            # piel al día, selectores, comentarios, reglas (214), lote (27), gastos (58), tonos (26, v0.8.0), sw, datos
npm run test:e2e    # PowerShell + Edge headless, 6 corridas: v0.9.0 = gerencia 236 · colaborador 235 · lectura 135 · tesoreria 252 · contabilidad 250 · sin-gastos 202 (v0.8.0: 222 · 221 · 122 · 238 · 236 · 188)
python ../herramientas-cfdi/test_cruce_cfdi.py   # v0.7.0: reglas del cruce con CFDI (25, una contra el índice real si está sincronizado)
node ../herramientas-dev/capturas.mjs --salida ../docs/capturas/v<versión>   # 390/1366 × claro/oscuro, mide desborde
```

La E2E (`test/pruebas.html`) reusa **literal** el MSAL falso, el Graph falso y la bitácora del arnés de Proyectos.
Escenarios de v0.2.0: entrada y rol, rail (5 destinos + 2 próximamente, `aria-current`, contador), grupos de Mis
pendientes con fechas en hora de México, un título con HTML pintado como texto, de un pendiente a su proyecto, kanban
con cubetas default/propias/«Sin cubeta», lista de proyectos, clave inexistente, las «en construcción» (desde v0.5.0 solo Gastos; desde v0.6.0 ninguna), hash
desconocido, tema claro/oscuro con el color de fondo medido, y cero escrituras.

Capturas de v0.2.0: `../docs/capturas/v0.2.0/` (Inicio y Proyecto, 390 y 1366, claro y oscuro; `_mediciones.txt`:
overflowX = 0 en las 8).

La capa privada de `datos.test.js` lee `../herramientas-dev/datos-prohibidos.txt` (copia de la de Proyectos, fuera
de este repo).

## Qué falta

- Escribir una vez en real por lista (PENDIENTE de Carlos, arriba).
- ~~Fase 4, lo que sigue: en la ficha, color, subir/bajar orden y «crear y otra»; en Archivos, mover una liga a otra tarjeta
  (F1 de Proyectos) y el árbol plegable de expediente (v0.33.0); borrar una nota~~: HECHO en **v0.8.0** (sección abajo), con
  la paridad de la ficha y de Documentos cerrada. ~~Queda fuera: el árbol en `#archivos`~~: HECHO en **v0.9.0** (abajo). Mover una
  liga desde `#archivos` o desde la ficha **no se hace porque Proyectos tampoco lo hace** (evidencia en la sección v0.9.0): con eso
  la paridad de Archivos con Proyectos v0.160.0 queda cerrada.
- **Escribir una vez en real** lo de v0.9.0: no aplica — v0.9.0 no escribe nada nuevo (el árbol solo lee).
- **Escribir una vez en real** lo de v0.8.0 (PENDIENTE de Carlos): un color, un Subir/Bajar, un «Crear y otra», mover una liga
  y borrar una nota, y ver que Proyectos lo pinta igual (sección v0.8.0).
- **Escribir una vez en real en `PROY_Ligas`** (subir un lote al buzón de CALYTEK, ligar, pegar enlace, quitar) y ver que
  Proyectos lo pinta igual y que `/archivar-calytek` reconoce el lote (PENDIENTE de Carlos, como el de `PROY_Tareas`).
- ~~Remoto~~: HECHO — repo público `MINSA-ENERGY/minsa-erp` + GitHub Pages; v0.7.0 publicada el 2026-10-02 (push de Carlos).
- ~~Login real~~: HECHO — Carlos entró en `erp.minsaenergy.com` y registró un gasto real el 2026-10-02 (dicho por él; `proponer-cfdi.ps1` leyó ese renglón de `ERP_Gastos`).
- Fase 5: provisionar Gastos y escribir una vez en real (PENDIENTE de Carlos, sección v0.6.0); fase 6 (CFDI): código hecho en v0.7.0, falta la primera corrida real (PENDIENTE de Carlos, sección v0.7.0).

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

## v0.6.0 (2026-10-01) — Gastos (fase 5 del plan)

### Antes de que funcione: lo que tiene que correr Carlos

**Hasta que Carlos provisione, `#gastos` dice «Gastos aún no está habilitado — falta crear la lista»** y el resto de la app
sigue igual (la E2E corre la app entera sin esas listas: corrida `sin-gastos`). Para habilitarlo, una sola vez, con su cuenta:
los 10 pasos de **`../docs/gastos-instrucciones-carlos.md`** (permiso temporal `manage`, `herramientas-dev/provisionar-gastos.html`
crea `ERP_Gastos`, `ERP_Roles` y la biblioteca «Gastos» con su `_LEEME`, se regresa a `write`, versiones activadas y
`ERP_Roles` sin herencia) y **capturar en `ERP_Roles` quién es tesorería**. Sin un renglón activo de tesorería nadie puede
marcar un gasto como reembolsado (la pantalla lo dice si falta la lista `ERP_Roles`). Después, recargar la app.

### Qué hace

| Dónde | Quién | Qué |
|---|---|---|
| `#gastos` | quien escribe en la app (gerencia, colaborador) y tesorería | **«+ Registrar gasto»** (diálogo `.mn-dialog`, el botón dice qué falta): monto (total con IVA), moneda (MXN/USD), concepto, fecha del ticket (nace hoy; no futura), categoría, proyecto opcional (pone su equipo), equipo, notas, y el **comprobante opcional**: «Tomar foto» (`capture`, abre la cámara del celular) o «Elegir archivo» (foto o PDF). Sin comprobante, la nota es obligatoria (decisión 7). |
| `#gastos` | todos | **Mis gastos** (por `Solicitante`): fecha, concepto, proyecto · equipo, monto en IBM Plex Mono con su moneda, estado (registrado · reembolsado · rechazado con quién y por qué), «Ver comprobante» (abre la liga de SharePoint), el chip de CFDI **solo si la columna trae valor**, y «por reembolsarte» sumado por moneda. |
| renglón sin comprobante | su dueño, quien lo capturó o tesorería | **«Agregar comprobante»**: si la subida falló al registrar (o se registró sin ticket), se sube después. |
| `#gastos/tesoreria` | **solo tesorería** (`ERP_Roles`, `Activo`) | La cola de **todo lo registrado** del equipo (lo más viejo arriba), con solicitante y «capturó X» si fue otra persona; **«Marcar reembolsado»** y **«Rechazar»** (motivo obligatorio); KPIs: por reembolsar (por moneda), reembolsado este mes (por la fecha del reembolso), sin comprobante; **totales por mes y moneda** (pesos y dólares nunca se suman); los resueltos plegados. Señala el gasto que **ya se había reembolsado** y volvió a «registrado» (guarda contra el doble pago) y pregunta antes de volver a marcarlo. Tesorería además **captura por el empleado** («Para quién», decisión 5). |

Nadie más ve los botones de tesorería, y `marcarReembolsado`/`rechazarGasto` se niegan si se llaman a la fuerza (la E2E lo
prueba en las corridas gerencia y colaborador). Lectura ve sus gastos y no escribe nada, ni forzando (corrida lectura: «CERO
escrituras también con Gastos», tras forzar `abrirNuevoGasto`, el envío del formulario y `agregarComprobante`). Código: `gastos.js` (pantalla y escrituras) y
`gastos-reglas.js` (reglas puras, `test/gastos.test.js`). `ERP_Gastos` y `ERP_Roles` se leen **al entrar a `#gastos`**, no al
abrir la app.

### Qué escribe y dónde

| Acción | SharePoint (sitio Administracion) |
|---|---|
| Registrar | `ERP_Gastos` POST: `Title` (concepto), `Fecha` (18:00Z del día), `Monto`, `Moneda`, `Categoria`, `Equipo`, `ProyectoId`, `Solicitante`, `CapturadoPor`, `Estado=registrado`, `CfdiEstado=sin-cfdi`, `Notas` |
| Comprobante | Biblioteca **«Gastos»** (su propio drive, `/sites/{id}/lists/{Gastos}/drive`, **no** la biblioteca Documentos): carpeta `AAAA-MM` del mes del **ticket** (la crea si no existe; 409 = ya estaba) y el archivo `AAAA-MM-DD_GASTO-<ID>_<Ticket|Factura>_<descripcion>.<ext>` con `conflictBehavior=fail`: **nunca sobrescribe**, si existe prueba `_2`, `_3`… Luego `ERP_Gastos` PATCH (If-Match) de **solo** `ComprobanteItemId` y `ComprobanteRuta` |
| Marcar reembolsado | `ERP_Gastos` PATCH (If-Match): `Estado=reembolsado`, `ReembolsadoPor`, `ReembolsadoEl`. **Ningún otro PATCH de la app toca el sello**: no se limpia nunca |
| Rechazar | `ERP_Gastos` PATCH (If-Match): `Estado=rechazado`, `RechazadoPor`, `RechazadoEl`, `MotivoRechazo` (255). El renglón y el comprobante se quedan |

- **412**: no se pisa; se releen los gastos, se avisa y se puede volver a intentar.
- **No escribe** ninguna `PROY_*` ni `PROY_Actividad` (su `Accion` es un choice cerrado y la decisión 6 congela su esquema): la
  traza de Gastos es `CapturadoPor`/`ReembolsadoPor`/`RechazadoPor` más el historial de versiones de la lista (paso 10 de las
  instrucciones). Por eso **«Escribió en la app» de Equipo no cuenta los gastos** todavía.
- **Esquema**: `esquema.json` suma `ERP_Gastos`, `ERP_Roles` y la llave `bibliotecas`, idénticas a `../docs/gastos-esquema.json`
  (lo coteja `test/gastos.test.js` si encuentra el archivo); las `PROY_*` no cambian. `config.js`: `listas.gastos`,
  `listas.rolesErp`, `bibliotecaGastos`. `graph.js` suma `existeLista`, `driveDeLista`, `asegurarCarpetaEnDrive`, `subirADrive` e
  `itemDeDriveId`.
- **Columnas CFDI** (fase 6): solo se muestran si traen valor; al registrar se escribe `CfdiEstado=sin-cfdi` (el estado normal de la
  decisión 8). La tarea semanal y la confirmación de contabilidad llegaron en **v0.7.0** (abajo).
- **PENDIENTE de Carlos — escribir una vez en real**: nada de esto se ha escrito contra SharePoint real. Después de provisionar:
  registrar un gasto con foto desde el celular (ver que llegue a `Gastos/AAAA-MM/` con el nombre de la convención), otro sin
  foto con nota, y marcar uno reembolsado y otro rechazado con la cuenta de tesorería.

### Defaults del implementador (se revierten en una línea)

- **Lectura no registra gastos** (como en el resto de la app); quien deba registrar necesita colaborador en `PROY_Roles` o
  tesorería en `ERP_Roles`. Revertir: `PUEDE_GASTO.registrar` en `gastos-reglas.js`.
- **Dos botones de comprobante** («Tomar foto» con `capture` y «Elegir archivo» sin él, como la maqueta) en vez de un solo
  `<input capture>`: con `capture` el celular abre directo la cámara y no deja escoger un PDF. Revertir: el bloque del
  comprobante en `dlgGasto` (`index.html`).
- **Un solo comprobante por alta** (foto o PDF, hasta 25 MB). Un segundo archivo del mismo gasto se sube a mano a la misma
  carpeta con el sufijo `_2` (lo dice el `_LEEME`). `COMPROBANTE_MAX_MB` en `gastos-reglas.js`.
- **La fecha del ticket no puede ser futura**. Revertir: la condición `c.dia > c.hoy` de `faltanGasto`.
- **`CfdiEstado=sin-cfdi` al registrar**. Revertir: quitarlo de `camposGasto`.
- **Se lee la lista entera** de `ERP_Gastos` (tesorería necesita todo; ~11 personas, todos ven todo en SharePoint). Si crece,
  filtrar por `Solicitante` (indexada) para quien no es tesorería, en `cargarGastos`.
- **El empleado ve solo sus gastos en la app**; contabilidad tiene su pestaña desde v0.7.0.
- **Nombre de quien no está en `PROY_Roles`**: se toma de `ERP_Roles.Nombre` (tesorería puede no tener rol de proyectos).

### Cómo revertir

`git revert` del commit de v0.6.0 en este repo (no toca datos). Por partes: quitar `gastos.js` y `gastos-reglas.js` (su import y
`pintarGastos`/`engancharGastos` en `app.js`, sus dos renglones en `sw.js`, `test/gastos.test.js` en `package.json`) y el
`<dialog id="dlgGasto">`; devolver `gastos` a `EN_CONSTRUCCION` en `pantallas.js`. Lo que ya se haya escrito en real
(renglones de `ERP_Gastos`, comprobantes en «Gastos») se queda en SharePoint: el revert no lo borra.

### Pruebas y capturas

- `npm test`: + `test/gastos.test.js` (47: esquema fundido contra los catálogos, roles, cola, totales, nombre del comprobante,
  lo que falta, campos que viajan).
- `npm run test:e2e`: 5 corridas — gerencia 180 · colaborador 179 · lectura 107 · **tesoreria 196** (colaborador + tesorería en
  `ERP_Roles`: cola, reembolsar con If-Match, doble pago, rechazar con motivo, 412, captura por otro) · **sin-gastos 149** (la app
  entera sin `ERP_Gastos`/`ERP_Roles`/biblioteca). Graph falso con el drive de «Gastos» (`/drives/drive-gastos/…`, 409 de
  verdad): alta con foto y choque de nombre (`_2`), alta sin foto con nota, subida que falla y «Agregar comprobante».
- Capturas: `../docs/capturas/v0.6.0/`, 390 y 1366, claro y oscuro, **página completa** (`capturas.mjs --completa`; con un
  diálogo abierto, además su pie en `*-pie`): gerencia = `gastos` (Mis gastos) y `nuevo-gasto`; tesoreria = `tesoreria` (cola,
  KPIs, totales) y `nuevo-gasto` (con «Para quién»); sin-gastos = `gastos` («aún no habilitado»). Sin fotos repetidas de la
  misma pantalla (`--plan`). `_mediciones.txt`: fixture, overflowX y fuera-de-ancho por foto. Graph falso: ningún dato real;
  fotos del estado DESPUÉS de la E2E (por eso «Casetas a planta», «Taxi a la notaría» y el gasto de «Colega Demo»).

## v0.7.0 (2026-10-02) — CFDI de gastos (fase 6 del plan, decisión 8)

### Las tres piezas

```
laptop de Carlos (lunes 09:00)                         la app (#gastos/contabilidad)
  ../docs/proponer-cfdi.ps1                              cola «CFDI por confirmar» (solo contabilidad)
    [-DescargarSat] descargar_sat.py incremental           «Confirmar este» → confirmado + CfdiUuid
    lee ERP_Gastos  →  ../herramientas-cfdi/cruce_cfdi.py  «Ninguno es»    → sin-cfdi + descartados
    plan JSON (simula)  /  -Aplicar: PATCH con If-Match
```

| Pieza | Dónde | Qué |
|---|---|---|
| Reglas | `../herramientas-cfdi/cruce_cfdi.py` (Python stdlib) + `test_cruce_cfdi.py` | Gastos (JSON) + uno o más `indice.csv` → plan JSON. Recibidas tipo I, MXN, no canceladas; total **al centavo**; ±30 días; índices unidos por UUID (si alguno dice cancelado, gana); fuera lo ya ligado (`CfdiUuid`) y lo descartado para ESE gasto. Se marca sola (`tarea-semanal`) solo con un candidato que ningún otro gasto comparte. El plan trae su propio chequeo del invariante; si se rompe, sale con 3 y el script no escribe. |
| Script | `../docs/proponer-cfdi.ps1` v1.0.0 (ASCII con BOM) | Patrón del exporte de Proyectos: código de dispositivo, refresh token DPAPI en `%LOCALAPPDATA%\MINSA\minsa-erp-cfdi.token`, `-Programada`, transcript y `_ultima-corrida.json`, sello de versión y hora. **Simula por omisión**; `-Aplicar` escribe con If-Match (412 = se omite, no se pisa) y relee lo escrito. Instrucciones: `../docs/cfdi-instrucciones-carlos.md`. |
| App | `gastos.js` (`pintarContabilidad`, `confirmarCfdi`, `ningunoCfdi`) y `gastos-reglas.js` | Pestaña **Contabilidad** en `#gastos/contabilidad` (con «por confirmar N»), visible solo con `ERP_Roles` contabilidad; KPIs por confirmar · confirmados este mes (y cuántos marcó la tarea: la tasa de la decisión 8) · sin CFDI. Cada gasto con sus candidatos: emisor, fecha, RFC, total, UUID corto (completo en el title). |

### Qué escribe y dónde

| Acción | `ERP_Gastos` (PATCH con If-Match) |
|---|---|
| Tarea, candidato único no compartido | `CfdiEstado=confirmado`, `CfdiUuid`, `CfdiConfirmadoPor=tarea-semanal`, `CfdiConfirmadoEl`, `CfdiCandidatos=null` |
| Tarea, varios o compartido | `CfdiEstado=propuesto`, `CfdiCandidatos=[{uuid,total,fecha,emisor,rfc,folio}…, {uuid,descartado:true}…]` |
| Tarea, ninguno | `CfdiEstado=sin-cfdi` (y los descartados que ya hubiera) — solo si cambió algo |
| «Confirmar este» | Antes relee `fields/CfdiUuid eq '<UUID>'` (indexada): si otro gasto ya lo tiene, se niega y nombra cuál. Luego `confirmado`, `CfdiUuid`, `CfdiConfirmadoPor` = correo, `CfdiConfirmadoEl`, `CfdiCandidatos=null` |
| «Ninguno es» | Pregunta antes. `CfdiEstado=sin-cfdi`, `CfdiCandidatos` = todos los UUID (los de antes y los propuestos) como `{uuid, descartado:true}` |

- **Esquema**: no cambia; todas son columnas Cfdi* que ya existen en el tenant (`gastos-esquema.json`). La E2E coteja cada PATCH contra `esquema.json`.
- **Roles**: `confirmarCfdi` / `ningunoCfdi` se niegan si se llaman a la fuerza sin el rol (corridas gerencia, colaborador, lectura, tesoreria).
- **412**: no se pisa; se releen los gastos, se avisa y el segundo intento escribe (E2E).

### Defaults del implementador (se revierten en una línea)

- **Reglas en Python stdlib**, no en JS: corren en la laptop junto a `descargar_sat.py` sin Node, y la prueba contra el
  índice real (7,219 renglones) no tiene que pasar por el navegador. La app solo lee/escribe el formato (sus reglas en
  `gastos-reglas.js`, probadas con un texto literal de lo que escribe Python). Revertir: portar `cruzar()` a JS.
- **Gastos evaluados**: `CfdiEstado` vacío, `sin-cfdi` o `propuesto`; **solo MXN** (no hay CFDI en dólares que cruzar,
  decisión de las reglas); **se salta lo `rechazado`** (no roba un CFDI a otro gasto). `ESTADOS_EVALUADOS` y `evaluable()`
  en `cruce_cfdi.py`.
- **Día del gasto en hora de México con UTC-6 fijo** (sin horario de verano desde 2022; `zoneinfo` no trae zonas en
  Windows sin `tzdata`). La fecha del CFDI se toma tal cual (hora local del emisor). `MEXICO` en `cruce_cfdi.py`.
- **Ventana ±30 días inclusive**; `VENTANA_DIAS` o `--ventana`.
- **Se guardan hasta 10 candidatos** por gasto (los más cercanos en fecha); la regla de unicidad cuenta todos.
  `MAX_CANDIDATOS`.
- **`CfdiCandidatos` en ASCII** (`ensure_ascii`): viaja intacto por PowerShell 5.1; `JSON.parse` lo devuelve con acentos.
- **«Ninguno es» descarta TODOS los candidatos mostrados** (no uno por uno) y pide confirmación. Revertir: quitar el
  `confirmar(...)` de `ningunoCfdi` o descartar por candidato.
- **Sin CFDI = estado normal**: KPI informativo, sin rojo ni contador en el rail.
- **El plan y la copia de gastos viven en `%LOCALAPPDATA%\MINSA\erp-cfdi\`** (datos reales; fuera del repo y del
  respaldo). `-Programar` registra **lunes 09:00** con `-Aplicar -DescargarSat -Programada`; cambiar el disparador en
  `proponer-cfdi.ps1` (sección 6).
- **Si `descargar_sat.py` falla**, la corrida sigue con los índices que ya hay y lo anota en `_ultima-corrida.json`.
- **Rol**: Mayeul tiene tesorería y contabilidad (`ERP_Roles`, 2-oct): ve las tres pestañas.

### Cómo revertir

`git revert` del commit de v0.7.0 en este repo (la pestaña y sus reglas; no toca datos). Fuera de este repo, borrar
`../herramientas-cfdi/`, `../docs/proponer-cfdi.ps1` y `../docs/cfdi-instrucciones-carlos.md`, y si ya se registró, la tarea
«MINSA - CFDI semanal del ERP». Lo que la tarea o Mayeul ya escribieron en `ERP_Gastos` se queda (son columnas de la
lista); para regresar un gasto, `CfdiEstado=sin-cfdi` y vaciar `CfdiUuid`/`CfdiCandidatos` en SharePoint.

### PENDIENTE de Carlos — la primera corrida real

1. Paso 8 de `../docs/gastos-instrucciones-carlos.md` hecho (sitio en `write`).
2. `proponer-cfdi.ps1` en simulación, revisar el plan, luego `-Aplicar` (`../docs/cfdi-instrucciones-carlos.md`).
3. Con la cuenta de Mayeul: confirmar uno y «Ninguno es» en otro; ver que la siguiente corrida no los re-propone.
4. `-Programar` cuando convenza.

### Pruebas y capturas

- `npm test`: `gastos` 47 → **58** (candidatos de Python con acentos por `\u`, JSON roto, cola, UUID ligado, campos de
  confirmar/«Ninguno es» contra el esquema, tasa del mes).
- `npm run test:e2e`: **6 corridas** — la nueva `contabilidad` (197): pestaña y chip, cola ordenada (sin el rechazado ni el
  propuesto vacío), candidato con emisor/fecha/RFC/total/UUID corto, emisor con HTML como texto, KPIs, confirmar el
  SEGUNDO candidato (relee `CfdiUuid eq`, PATCH con If-Match de 5 campos), UUID ya ligado en SharePoint que el gasto local
  no conocía (se niega y nombra el gasto), «Ninguno es» (cancelar no escribe; aceptar guarda los 2 descartados), 412 y
  segundo intento, cola vacía. Las otras corridas: sin pestaña, `#gastos/contabilidad` cae en Mis gastos y forzar se niega.
- `python ../herramientas-cfdi/test_cruce_cfdi.py`: **25** (24 casos sintéticos + 1 contra el índice maestro real, solo
  lectura: 155 gastos sintéticos de agosto 2026 → 47 marcados solos · 58 propuestos (21 por ambigüedad cruzada) · 50 sin
  candidatos · **0 marcas automáticas ambiguas**, recontado aparte).
- Capturas: `../docs/capturas/v0.7.0/`, rol contabilidad, 390 y 1366, claro y oscuro, página completa
  (`--plan "contabilidad:contabilidad" --completa`; `_mediciones.txt`: overflowX = 0 y fuera-de-ancho = 0 en las 4). La E2E
  deja la cola vacía, así que `capturas.mjs` siembra antes dos gastos propuestos (`PREP`). Graph falso: ningún dato real.
- **No probado**: nada contra el tenant real (login del script, lectura y PATCH de `ERP_Gastos`, el filtro `CfdiUuid eq`
  en SharePoint, la tarea programada, `-DescargarSat`).

## v0.8.0 (2026-10-02) — cierre de la fase 4: la ficha y Documentos completos

Lo que «Qué falta» llamaba *Fase 4, lo que sigue*, portado de MINSA Proyectos v0.160.0 (`tablero.js`, `docs.js`, `comun.js`)
con la misma lógica. **Nada exigió cambiar `esquema.json` ni una columna de SharePoint**: `Color`, `Orden` y `TareaId` ya existen
en `PROY_Tareas`/`PROY_Ligas`; borrar una nota es un DELETE; y ni reordenar ni borrar una nota escriben bitácora, así que
`PROY_Actividad.Accion` (congelada, decisión 6) no cambia — mover una liga usa `ligar`, que ya existe.

### Qué hace

| Dónde | Qué | De dónde sale |
|---|---|---|
| Ficha · **Color** | Fila de 9 círculos (sin color + los 8 de `COLORES`), grupo de radios con flechas. Viaja en el mismo PATCH de «Guardar cambios», **solo si cambió**; «Sin color» manda `null`. La tarjeta del tablero se tiñe. | `selectorTonos` de `tablero.js` v0.12.0 |
| Nueva tarea · **Color** y **«Crear y otra»** | El color se elige al crear. «Crear y otra» guarda y deja el diálogo abierto con cubeta, asignado, prioridad, vence y color; vacía título y descripción y devuelve el foco al título. Se enciende con el mismo criterio que «Crear tarea». | C1 de Proyectos v0.5.0 |
| Ficha · **Subir / Bajar** | Bajo «Mover a»: «Lugar en la cubeta: N de M» con ↑ Subir / ↓ Bajar (solo si la cubeta tiene más de una). Renumera `Orden` en el orden visual (`reordenar` de `reglas.js`): la primera vez puede ser la cubeta entera (las sembradas no traen `Orden`), luego las dos que se cruzan. No toca lo que se está escribiendo en la ficha. | F11 de Proyectos |
| Ficha · **Borrar una nota** | «Borrar» en la cabecera de la nota: la propia, o cualquiera si gerencia; proyecto activo. Pregunta antes (la confirmación sale encima de la ficha). | `borrarComentario` de `comun.js` (Proyectos v0.9.0) |
| Documentos · **Mover a** | Bajo el nombre de cada documento, un select con las tarjetas del proyecto («el proyecto entero» arriba). Confirma nombrando de dónde a dónde; cancelar devuelve el select y no escribe. La carpeta de destino se abre sola. | F1 de `docs.js` (`reasignarLiga`, v0.34.0) |
| Documentos · **árbol de expediente** | «Del proyecto» y una **carpeta por tarjeta** (título, cubeta, vencimiento, «N docs»; el icono toma el color de la tarjeta o el de su cubeta), que se pliega con un clic. **Nace todo plegado**; «Abrir todo» / «Plegar todo» se apagan cuando no tienen nada que hacer. Lo abierto sobrevive a los repintados mientras no se cambie de proyecto. | Proyectos v0.33.0 / v0.52.0 |
| Tablero | La tarjeta y la cubeta con color elegido (aquí o en Proyectos) se tiñen: `pantallas.js` ya ponía `data-color` sin regla CSS; ahora es `data-tono`, el atributo que pinta `estilo.css`. | — |

### Qué escribe y dónde

| Acción | SharePoint | `PROY_Actividad` |
|---|---|---|
| Color (ficha) | `PROY_Tareas` PATCH con If-Match, solo `Color` (o junto con lo demás que cambió) | `editar-tarea` «editó «X»» (la misma de siempre) |
| Crear con color / «Crear y otra» | `PROY_Tareas` POST, + `Color` si se eligió | `crear-tarea`, uno por tarjeta |
| Subir / Bajar | `PROY_Tareas` PATCH con If-Match de solo `Orden`, uno por tarjeta que cambia | **ninguno** (como Proyectos) |
| Mover una liga | `PROY_Ligas` PATCH con If-Match de solo `TareaId` (`null` = el proyecto entero) | `ligar` «pasó la liga «X» a «T»» / «dejó la liga «X» para el proyecto entero» (frases de Proyectos) |
| Borrar una nota | `PROY_Actividad` DELETE de ese renglón (más sus ✓ «visto», best-effort) | **ninguno**: `Accion` está congelada; el renglón queda en la papelera del sitio |

- **Roles**: lectura ve el color apagado, sin Subir/Bajar, sin «Mover a» ni «Borrar» — y `reordenarTarea`, `reasignarLiga` y
  `borrarComentario` se niegan si se llaman a la fuerza (E2E). Colaborador borra solo sus notas; gerencia, cualquiera.
- **412**: no se pisa — Subir/Bajar y Color pasan por el `conflicto` de la ficha (relee y repinta); mover una liga relee y avisa.

### Defaults del implementador (se revierten en una línea)

- **El árbol nace todo plegado** (la decisión de Carlos en Proyectos v0.52.0). Revertir: en `pintarDocsProyecto` (`archivos.js`),
  iniciar `arbol.abiertas` con todas las `llaves` en vez de `new Set()`.
- **Las tarjetas sin documentos NO entran al árbol** (Proyectos pone ahí un nodo «N tarjetas abiertas sin documentos»): el ERP
  ya las enseña arriba en «Qué documentos faltan» (decisión de v0.5.0, maqueta). Sumarlas sería repetir la lista.
- **Al mover una liga se abre la carpeta de destino**, para ver a dónde fue. Revertir: la línea `arbol.abiertas.add(…)` de
  `reasignarLiga`.
- **«Mover a» es un select visible bajo el nombre** (Proyectos v0.55.0 lo metió al menú «⋯»; el ERP no tiene ese menú) y solo
  en Documentos del proyecto (como Proyectos: `#archivos` no reasigna). Revertir: quitar `moverEn: p` en `pintarDocsProyecto`.
- **Paleta de tonos sin colores nuevos** (la paleta es decisión de Carlos, `deuda-declarada.txt`): azul = `--brand` (se aclara
  solo en oscuro), celeste `--sky-600`, verde `--green-700`, ámbar `--amber-600`, rojo `--red-600`, gris `--slate-400`; **morado y
  rosa**, que la paleta del ERP no trae (Proyectos usa dos hex propios), salen de **mezclar dos tokens** de ella con `color-mix`
  (azul marca + rojo). Lo vigila `test/tonos.test.js`: ningún `--tono-*` con color literal. Revertir/ajustar: el bloque `:root`
  de v0.8.0 en `estilo.css`.
- **El tinte no toca el filete izquierdo** de la tarjeta (sigue diciendo la cubeta): solo fondo y los otros tres bordes. Revertir:
  `.kc[data-tono]` en `estilo.css`.
- **Sin la columna `Color` en la lista, el selector no se enseña** (`hayColor()` mira `estado.columnasTareas`; si no se pudieron
  leer, se asume que sí, como Proyectos). Revertir: `hayColor` en `tarjetas.js`.
- **«Crear y otra» conserva cubeta, asignado, prioridad, vence y color** y vacía título y descripción (lo de Proyectos más el color).
  Revertir: la rama `seguirCapturando` de `guardarNueva`.
- **Borrar una nota es un botón de texto «Borrar»** (Proyectos usa el icono de basura) y **pregunta con el diálogo de
  confirmación encima de la ficha** (borrar una tarjeta sigue siendo de dos toques). Revertir: el bloque `puedeBorrarComentario`
  de `pintarNotas`.
- **Subir/Bajar dicen «↑ Subir» / «↓ Bajar» con texto** y van dentro de la caja «Mover a» (solo se ve si el rol mueve).

### Qué NO se hizo (y por qué)

- ~~**El árbol en `#archivos`** (Proyectos v0.36.0: una raíz plegable por proyecto)~~: llegó en **v0.9.0**.
- **Mover una liga desde la ficha o desde `#archivos`**: Proyectos tampoco lo hace desde `#archivos`; en la ficha, los
  documentos ya son de esa tarjeta y Documentos lo resuelve.
- **El color de las cubetas** (editor de cubetas de Proyectos v0.11.0/v0.12.0): no estaba en el alcance; el ERP solo **pinta** el
  color que una cubeta ya trae.

### Cómo revertir

`git revert` del commit de v0.8.0 en este repo (no toca datos). Por partes: en `tarjetas.js`, `selectorTonos`, `hayColor`,
`pintarOrden`/`reordenarTarea`, la rama `seguirCapturando` y el botón de `pintarNotas`; en `index.html`, `ntColorCampo`,
`ntGuardarYOtra`, `fColorCampo` y `fOrden`; en `archivos.js`, `reasignarLiga`, `moverEn` de `filaLiga` y el árbol
(`arbol`, `aplicarPliegue`) de `pintarDocsProyecto`; en `estilo.css`, el bloque v0.8.0; `test/tonos.test.js` y su renglón de
`package.json`. Lo que ya se haya escrito en real (colores, `Orden`, ligas movidas, notas borradas) queda en SharePoint y
Proyectos lo pinta igual: son las mismas columnas; una nota borrada se recupera de la papelera del sitio.

### PENDIENTE de Carlos — escribir una vez en real

Nada de v0.8.0 se ha escrito contra SharePoint real. Con una tarjeta de prueba: elegir un color (y ver que Proyectos la tiñe
igual), Subir/Bajar en una cubeta de 2+, «Crear y otra» dos veces, mover un documento a otra tarjeta y de vuelta al proyecto, y
borrar una nota propia (y que desaparezca también del chat de Proyectos).

### Pruebas

- `npm test`: + `test/tonos.test.js` (26: cada clave de `COLORES` con su token y su regla, ningún tono con color literal).
- `npm run test:e2e`: gerencia 183 → **222** · colaborador 182 → **221** · lectura 110 → **122** · tesoreria 199 → **238** ·
  contabilidad 197 → **236** · sin-gastos 149 → **188**. Nuevo: el color sembrado «desde Proyectos» tiñe la tarjeta y su carpeta;
  el árbol (nace plegado, abrir uno, abrir/plegar todo); «Crear y otra» (POST con color, lo que se conserva, Orden + 1, foco);
  color en la ficha (PATCH de solo `Color` con If-Match, «Sin color» = `null`); Subir/Bajar (numera la cubeta, luego dos,
  sin bitácora, no pierde lo escrito); mover una liga (confirmar, cancelar, PATCH de solo `TareaId`, frase de bitácora, carpeta que
  se abre, 412, al proyecto entero); borrar una nota (confirmar encima de la ficha, cancelar, DELETE único, sin bitácora; la ajena
  solo gerencia); lectura: nada de eso, ni forzando.
- Sin capturas nuevas en esta versión (no se corrió `capturas.mjs`).

## v0.9.0 (2026-10-02) — paridad de Archivos con Proyectos: el árbol en `#archivos`

Lo que v0.8.0 dejó fuera de la fase 4 («paridad con Proyectos»), contra MINSA Proyectos v0.160.0 (`vistas.js` `pintarArchivosCuerpo`,
`docs.js` `filasDeExpediente` / `filaRaiz` / `filaDoc`). **No escribe nada nuevo** en SharePoint, no toca `esquema.json` ni
`PROY_Actividad.Accion` (decisión 6).

### Qué hace

| Dónde | Qué | De dónde sale |
|---|---|---|
| `#archivos` · **árbol** | Una **raíz plegable por proyecto** (caret, carpeta, icono del equipo, título, «N documentos» o «N de M» con filtro, botón **Documentos** que abre su pestaña) y debajo **el mismo expediente que Documentos**: «Del proyecto» y una carpeta por tarjeta (cubeta, vencimiento, «N docs», color de la tarjeta o de su cubeta). **Nace todo plegado**; lo abierto **vive la sesión** (`estado.abiertasArchivos`, llaves `p7`, `p7/0`, `p7/t12`), como el filtro. «Abrir todo» / «Plegar todo» se apagan cuando no tienen nada que hacer. | Proyectos v0.36.0, v0.45.0 (sin la tarjeta por renglón: la carpeta la nombra) y v0.51.0 |
| `#archivos` · **con filtro** | Con tipo, proyecto o texto **todo se ve abierto**, el caret no toca lo abierto y los dos botones se apagan; al soltar el filtro el árbol vuelve a como estaba. | U-01 de Proyectos (17-sep) |
| Código | Un solo árbol: `expediente()`, `nodoCarpeta()`, `carpetaArbol()`, `barraDeArbol()` y `aplicarPliegue()` (`archivos.js`) los usan **Documentos y `#archivos`**; el de Documentos es el de v0.8.0 refactorizado (mismo DOM, sus llaves pasan a texto: `'0'`, `'12'`). | `filasDeExpediente` de Proyectos |

### Mover una liga de tarjeta: dónde lo permite Proyectos (y por qué el ERP no suma nada)

Verificado en el código de Proyectos v0.160.0:

| Vista | Proyectos | ERP |
|---|---|---|
| Documentos del proyecto | **Sí**: `filaDoc` arma `selectTarjeta` → `reasignarLiga` cuando `sinTarjeta && puede && p && !enArchivos` (renglón «Mover a» del menú «⋯», v0.55.0) | Sí, desde v0.8.0 (`reasignarLiga`, select «Mover a» bajo el nombre) |
| `#archivos` | **No**: `vistas.js` pinta las hojas con `doc: () => ({ p, enArchivos: true, alTarjeta })`, sin `puede` — el select no se arma; el subtítulo dice «Para ligar, quitar o cambiar de tarjeta, entra a Documentos del proyecto» | No (la E2E lo afirma: ni `[data-tarjeta-de]` ni `.mover-liga` en `#archivosLista`); la nota de la pantalla ahora dice «Para quitar una liga o cambiarla de tarjeta, entra a Documentos del proyecto» |
| Ficha de la tarjeta | **No**: `tablero.js` importa de `docs.js` solo `abrirLigar, abrirSubir, abrirEnlace, quitarLiga, puedeLigarEn, puedeEnlazarEn`; `reasignarLiga` ni siquiera se exporta. La ficha solo quita | No (E2E: la ficha tiene «Quitar» y no «Mover a») |

### Defaults del implementador (se revierten en una línea)

- **El árbol de `#archivos` nace todo plegado** (Carlos en Proyectos v0.51.0). Revertir: en `pintarListaArchivos`, sembrar
  `estado.abiertasArchivos` con todas las `llaves` la primera vez.
- **Lo abierto vive la sesión** (salir de `#archivos` y volver lo conserva; recargar lo pliega), como Proyectos. Revertir: vaciar
  `estado.abiertasArchivos` al entrar a la pantalla.
- **Sin el nodo «tarjetas sin documentos»** en el árbol (Proyectos tampoco lo pone en `#archivos`: «aquí solo se encuentra, no se
  liga»); el ERP las cuenta arriba en «Qué documentos faltan».
- **Sin «Abrir tarjeta» ni «Copiar ruta» por documento** (Proyectos los tiene en su menú «⋯»; el ERP no tiene ese menú y su renglón
  ya dice dónde quedó). Queda como diferencia conocida, fuera del alcance pedido.
- **El icono del equipo en la raíz** usa el color que el equipo ya trae en `config.js` (`--c`); sin colores nuevos. Revertir: quitar
  `icono: iconoEquipo(…)` en `pintarListaArchivos` y la regla `.raiz-docs .eqi`.
- **La E2E termina con «Abrir todo» en `#archivos`**, para que las capturas enseñen el árbol entero (las carpetas que la E2E crea
  después nacen plegadas, por eso «De la colega» sale cerrada).

### Cómo revertir

`git revert` del commit de v0.9.0 en este repo (no toca datos: v0.9.0 solo lee). Por partes: en `archivos.js`, devolver
`pintarListaArchivos` a la lista agrupada (`.grupo-docs` + `.sec`) y, si se quiere, re-inlinear el árbol de `pintarDocsProyecto`;
en `estilo.css`, el bloque v0.9.0 (y las dos reglas `.grupo-docs .sec`, que salieron por quedar sin uso).

### Pruebas y capturas

- `npm test`: sin cambios en los conteos (reglas 214 · lote 27 · gastos 58 · tonos 26 · sw · datos) — el árbol es DOM y lo prueba la E2E.
- `npm run test:e2e`: gerencia 222 → **236** · colaborador 221 → **235** · lectura 122 → **135** · tesoreria 238 → **252** ·
  contabilidad 236 → **250** · sin-gastos 188 → **202**. Nuevo: una raíz por proyecto con conteo y «Documentos»; el mismo expediente
  debajo (títulos, color morado de la tarjeta); nace todo plegado; abrir raíz y luego carpeta; con filtro todo se ve, el caret no
  pliega y los botones se apagan; al soltar el filtro vuelve a como estaba; «Abrir/Plegar todo»; lo abierto sobrevive a salir y
  volver; `#archivos` y la ficha sin «Mover a» (todos los roles para `#archivos`; los que escriben para la ficha).
- Capturas: `../docs/capturas/v0.9.0/` (archivos, docs, ficha × 390/1366 × claro/oscuro, gerencia, 12 PNG; `_mediciones.txt`:
  overflowX = 0 y fuera-de-ancho = 0 en las 12). A 390 la foto es de la ventana y el árbol queda abajo del pliegue. Graph falso:
  ningún dato real.
